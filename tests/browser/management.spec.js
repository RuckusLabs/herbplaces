import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

const image = '/assets/pages/home/hero.jpg';
const makePlace = () => ({ id: 'place-1', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', tagline: 'A little care, rooted in plants.',
  description: 'Herbal teas and community workshops.', website: 'https://example.com/', address: '123 Main Street', city: 'Denver', state: 'CO', zip: '80201',
  coverPhoto: image, photos: [image], latitude: 39.7, longitude: -104.9, isFeatured: false, isVerified: true,
  is_claimed: false, phone: '', hours: '', social_links: [], category_ids: ['shops'], photo_alt: {}, content_version: 1, geocode_status: 'confirmed' });

async function mockSite(page, { role = 'owner', expired = false, unpaid = false, conflict = false, confirmed = true, renewalProcessing = false, displayName = '' } = {}) {
  const state = { place: makePlace(), claims: [], listingRequests: [], authRequests: [], assigned: [], published: null, directoryRequests: [], removed: null, users: [
    { user_id: 'user-1', email: 'admin@example.com', is_admin: true, confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [] },
    { user_id: 'manager-1', email: 'owner@example.com', confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [{ id: 'place-1', name: 'Moss Apothecary', is_billing_contact: false, pending: false }] },
    { user_id: 'billing-1', email: 'billing@example.com', billing_protected: true, confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [{ id: 'place-1', name: 'Moss Apothecary', is_billing_contact: true, pending: false }] },
  ] };
  const user = { id: 'user-1', email: `${role}@example.com`, email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null, aud: 'authenticated', app_metadata: {}, user_metadata: { full_name: displayName } };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, role: 'authenticated' })).toString('base64url')}.local-test-signature`;
  const session = { access_token: token, refresh_token: 'local-test-refresh', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600, user };
  if (role !== 'guest') await page.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const subscription = { status: unpaid ? 'none' : expired ? 'canceled' : 'active', paid_until: unpaid ? null : new Date(Date.now() + 86400000).toISOString(), grace_ends_at: null, cancel_at_period_end: false };
  if (renewalProcessing) { subscription.paid_until = new Date(Date.now()-3600000).toISOString(); subscription.grace_ends_at = new Date(Date.now()+3600000).toISOString(); }
  const context = () => ({ is_admin: role === 'admin', memberships: role === 'owner' ? [{ place_id: state.place.id, is_billing_contact: true, can_edit: !expired, place: state.place, subscription }] : [], claims: state.claims });
  await page.route('**/auth/v1/**', route => {
    const request = route.request();
    state.authRequests.push({ url: request.url(), method: request.method(), body: request.method() === 'POST' || request.method() === 'PUT' ? request.postDataJSON() : null });
    if (state.authError) return route.fulfill({ status: 429, json: { msg: state.authError } });
    if (request.method() === 'PUT' && new URL(request.url()).pathname.endsWith('/user')) {
      if (state.authUpdateError) return route.fulfill({ status: 422, json: { msg: state.authUpdateError } });
      const body = request.postDataJSON();
      if (body.data) user.user_metadata = { ...user.user_metadata, ...body.data };
      if (body.email) user.new_email = body.email;
      return route.fulfill({ json: user });
    }
    return route.fulfill({ json: request.url().includes('/token') || request.url().includes('/signup') && !state.signupNeedsConfirmation ? session : request.url().includes('/recover') || request.url().includes('/resend') ? {} : user });
  });
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.includes('/rpc/') && state.published && state.refreshError && !path.endsWith('/favorites')) return route.fulfill({ status: 503, json: { message: 'Directory unavailable' } });
    if (!path.includes('/rpc/')) return route.fulfill({ json: path.endsWith('/favorites') ? (state.favorites || []) : [state.place, ...(state.extraPlaces || [])] });
    const name = path.split('/').at(-1);
    const body = request.postDataJSON() || {};
    if (name === 'activate_place_invitations') return route.fulfill({ json: null });
    if (name === 'admin_attention_counts') return state.attentionError ? route.fulfill({ status: 503, json: { message: 'Counts unavailable' } }) : route.fulfill({ json: state.attentionCounts || { claims: 1, 'listing-requests': state.listingRequests.filter(item => item.status === 'pending').length, locations: 0 } });
    if (name === 'get_management_context') return state.managementError ? route.fulfill({ status: 503, json: { message: state.managementError } }) : route.fulfill({ json: context() });
    if (name === 'get_listing_requests') return route.fulfill({ json: state.listingRequests });
    if (name === 'request_place_listing') {
      state.listingAttempts ||= []; state.listingAttempts.push(body);
      if (state.listingError) return route.fulfill({ status: 400, json: { message: state.listingError } });
      state.listingRequests.push({ id: body.p_request_id, name: body.p_name, city: body.p_city, address: body.p_address, zip: body.p_zip, website: body.p_website, region: body.p_region, notes: body.p_notes, status: 'pending', created_at: new Date().toISOString() });
      return route.fulfill({ json: body.p_request_id });
    }
    if (name === 'admin_listing_requests') return route.fulfill({ json: { items: state.listingRequests.filter(item => item.status === 'pending'), total: state.listingRequests.filter(item => item.status === 'pending').length } });
    if (name === 'admin_review_listing_request') {
      state.reviewedListing = body;
      state.listingRequests = state.listingRequests.map(item => item.id === body.p_request_id ? { ...item, status: body.p_slug ? 'listed' : 'declined', place_slug: body.p_slug, review_note: body.p_note } : item);
      return route.fulfill({ json: null });
    }
    if (name === 'admin_create_place') {
      state.creationAttempts ||= []; state.creationAttempts.push(body);
      if (state.creationError) return route.fulfill({ status: 400, json: { message: state.creationError } });
      state.created = body;
      state.place = { ...makePlace(), ...body.p_content, id: 'place-new', urlSlug: body.p_slug, isVerified: false, latitude: null, longitude: null, geocode_status: body.p_content.address ? 'pending' : 'review' };
      return route.fulfill({ json: state.place });
    }
    if (name === 'get_editable_place') return route.fulfill({ json: state.place });
    if (name === 'publish_place') {
      if (conflict) return route.fulfill({ status: 409, json: { code: 'PT409', message: 'Someone else updated this place. Reload the latest version before publishing.' } });
      state.published = body;
      state.place = { ...state.place, ...body.p_content, content_version: state.place.content_version + 1 };
      return route.fulfill({ json: state.place });
    }
    if (name === 'request_place_claim') {
      state.claimAttempts ||= []; state.claimAttempts.push(body);
      if (state.claimError) return route.fulfill({ status: 400, json: { message: state.claimError } });
      state.claimed = body;
      state.claims.push({ id: 'claim-1', place_id: state.place.id, name: state.place.name, urlSlug: state.place.urlSlug, status: 'pending', review_note: '' });
      return route.fulfill({ json: null });
    }
    if (name === 'admin_directory') { state.directoryRequests.push(body); if (state.directoryError) return route.fulfill({ status: 503, json: { message: state.directoryError } }); return route.fulfill({ json: body.p_section === 'claims'
      ? { total: 1, items: [{ id: 'claim-1', place_id: state.place.id, name: state.place.name, urlSlug: state.place.urlSlug, email: 'claimant@example.com', relationship: 'Owner', evidence: 'Please verify our business website.', created_at: new Date().toISOString() }] }
      : body.p_section === 'users' ? { total: state.users.length, items: state.users }
        : { total: 1, items: [{ ...state.place, subscription_status: 'active' }] } }); }
    if (name === 'admin_place_detail' && state.detailError) return route.fulfill({ status: 503, json: { message: state.detailError } });
    if (name === 'admin_place_detail') return route.fulfill({ json: { place: state.place, subscription,
      members: [{ user_id: user.id, email: 'owner@example.com', is_billing_contact: true }, ...state.assigned], invitations: [], revisions: [], audit: [] } });
    if (name === 'admin_assign_manager') { state.assigned.push({ user_id: body.p_email, email: body.p_email, is_billing_contact: body.p_billing }); return route.fulfill({ json: null }); }
    if (name === 'admin_review_claim') { state.reviewed = body; return route.fulfill({ json: null }); }
    return route.fulfill({ json: null });
  });
  await page.route('**/functions/v1/place-management', async route => {
    if (route.request().headers()['content-type']?.startsWith('multipart/form-data')) return route.fulfill({ json: { url: '/assets/pages/the-little-garden/garden.webp' } });
    const body = route.request().postDataJSON();
    if (body.action === 'geocode') { state.geocodedPlace = body.place_id; return route.fulfill({ json: { status: 'confirmed' } }); }
    return route.fulfill({ json: body.action === 'checkout' ? { url: 'https://checkout.stripe.com/c/pay/local-test' } : { synced: true } });
  });
  await page.route('**/functions/v1/admin-users', async route => {
    const body = route.request().postDataJSON();
    if (state.removalError) return route.fulfill({ status: 400, json: { error: state.removalError } });
    state.removed = body; state.users = state.users.filter(account => account.user_id !== body.user_id);
    return route.fulfill({ json: { removed: true } });
  });
  return state;
}

async function fillClaim(page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your full name').fill('Jamie Green');
  await dialog.getByRole('combobox', { name: 'Your role', exact: true }).selectOption('Owner');
  await dialog.getByLabel('Business email', { exact: true }).fill('jamie@moss.example');
  await dialog.getByLabel('Business phone (optional)').fill('303-555-0142');
  await dialog.getByLabel('Verification link (optional)').fill('https://moss.example/about');
  await dialog.getByRole('textbox', { name: 'Ownership details', exact: true }).fill('I founded Moss Apothecary. Our team page lists me as the owner, and you can contact me at our business email to confirm.');
  return dialog;
}

test('guests add ownership details before sign-in and resume their claim afterward', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' }); await page.goto('/place/moss-apothecary');
  await page.getByRole('complementary', { name: 'Plan a Little Visit.' }).getByRole('button', { name: 'Claim This Place' }).click();
  let dialog = await fillClaim(page);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await expect(dialog).toContainText('jamie@moss.example');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Sign In to Send Claim' }).click();
  await expect(page).toHaveURL(/login\?next=/);
  expect(state.claims).toHaveLength(0);
  await page.getByLabel('Email', { exact: true }).fill('guest@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password-for-test');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/moss-apothecary\?claim=1/);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Your full name')).toHaveValue('Jamie Green');
  await expect(dialog.getByRole('textbox', { name: 'Ownership details', exact: true })).toHaveValue(/I founded Moss Apothecary/);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('link', { name: 'Claim Pending' })).toBeVisible();
  expect(state.claims).toHaveLength(1);
  expect(await page.evaluate(() => sessionStorage.getItem('little-herb-place-claim:place-1'))).toBeNull();
  await expect(page).not.toHaveURL(/claim=1/);
});

test('confirmed users review and submit ownership evidence for admin review', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'claimant' }); await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Claim This Place' }).click();
  const dialog = await fillClaim(page);
  await dialog.evaluate(element => { element.scrollTop = 0; });
  await dialog.screenshot({ path: testInfo.outputPath('claim-details.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  expect(state.claims).toHaveLength(0);
  await expect(dialog).toContainText('Jamie Green · Owner');
  await dialog.screenshot({ path: testInfo.outputPath('claim-review.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  expect(state.claims).toHaveLength(0); // Confirmation is required before sending.
  await dialog.getByRole('button', { name: 'Edit Details' }).click();
  await expect(dialog.getByLabel('Your full name')).toHaveValue('Jamie Green');
  await dialog.getByLabel('Your full name').fill('Jamie Moss');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('link', { name: 'Claim Pending' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Your claim has been sent for review' })).toBeVisible();
  expect(state.claims).toHaveLength(1);
  expect(state.claimed.p_relationship).toBe('Owner');
  expect(state.claimed.p_evidence).toContain('Full name: Jamie Moss');
  expect(state.claimed.p_evidence).toContain('Business email: jamie@moss.example');
  expect(state.claimed.p_evidence).toContain('Business phone: 303-555-0142');
  expect(state.claimed.p_evidence).toContain('Verification link: https://moss.example/about');
  expect(state.claimed.p_evidence).toContain('I founded Moss Apothecary');
  expect(state.claimed.p_evidence.length).toBeLessThanOrEqual(3000);
});

test('claim details are validated and a public verification link is optional', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' }); await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Claim This Place' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await expect(dialog.getByLabel('Your full name')).toBeVisible();
  await fillClaim(page);
  await dialog.getByLabel('Business phone (optional)').fill('');
  await dialog.getByLabel('Verification link (optional)').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  // A browser URL input accepts arbitrary schemes; only web links should proceed.
  await expect(dialog.getByLabel('Verification link (optional)')).toBeVisible();
  await dialog.getByLabel('Verification link (optional)').fill('');
  await dialog.getByRole('textbox', { name: 'Ownership details', exact: true }).fill(' '.repeat(50));
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await expect(dialog.getByRole('alert')).toContainText('at least 40 characters');
  await dialog.getByRole('textbox', { name: 'Ownership details', exact: true }).fill('Please call our listed business phone and ask for Jamie to confirm that I own this business.');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('link', { name: 'Claim Pending' })).toBeVisible();
  expect(state.claimed.p_evidence).not.toContain('Verification link:');
});

test('failed claims retain details and can be retried', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' }); state.claimError = 'Please try again in a moment.';
  await page.goto('/place/moss-apothecary'); await page.getByRole('button', { name: 'Claim This Place' }).click();
  const dialog = await fillClaim(page);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Please try again in a moment.');
  await expect(dialog).toContainText('Jamie Green');
  state.claimError = '';
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('link', { name: 'Claim Pending' })).toBeVisible();
  expect(state.claimAttempts).toHaveLength(2);
});

test('unconfirmed accounts can prepare details but must confirm email before sending', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant', confirmed: false });
  await page.goto('/place/moss-apothecary'); await page.getByRole('button', { name: 'Claim This Place' }).click();
  const dialog = await fillClaim(page);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await expect(dialog.getByRole('alert')).toContainText('Confirm your email');
  await expect(dialog.getByRole('button', { name: 'Submit Claim' })).toBeDisabled();
  expect(state.claims).toHaveLength(0);
});

test('owners edit, preview, upload, and publish directly on their place page', async ({ page }, testInfo) => {
  const state = await mockSite(page); await page.goto('/place/moss-apothecary');
  const edit = page.getByRole('button', { name: 'Edit Place', exact: true });
  await expect(edit).toBeVisible();
  const editBox = await edit.boundingBox(); const locationBox = await page.locator('header p').filter({ hasText: 'Denver, CO' }).boundingBox();
  expect(editBox.y + editBox.height).toBeLessThan(locationBox.y);
  await edit.click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('Tagline', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor-top.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByLabel('Tagline', { exact: true }).fill('Newly gathered, just for you.');
  await dialog.getByLabel('Opening hours').fill('Monday–Friday: 10 am–6 pm');
  await dialog.getByLabel('Phone', { exact: true }).fill('303-555-0123');
  await dialog.getByRole('button', { name: 'Add Link', exact: true }).click();
  await dialog.getByLabel('Link text', { exact: true }).fill('Book a consultation');
  await dialog.getByLabel('Link URL', { exact: true }).fill('example.com/book');
  await dialog.getByLabel('Link text', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('editor-links.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByLabel('Add photos').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=', 'base64') });
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Unpublished preview', exact: true })).toBeVisible();
  await expect(page.locator('header p').filter({ hasText: 'Newly gathered, just for you.' })).toBeVisible();
  expect(state.published).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('place-editor.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('region', { name: 'Unpublished preview', exact: true }).getByRole('button', { name: 'Publish Changes', exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(page.getByText('Your changes are saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Monday–Friday: 10 am–6 pm', { exact: true })).toBeVisible();
  expect(state.published.p_expected_version).toBe(1); expect(state.published.p_content.photos).toHaveLength(2);
  await expect(page.getByRole('link', { name: 'Book a consultation' })).toHaveAttribute('href', 'https://example.com/book');
  await page.getByRole('complementary', { name: 'Plan a Little Visit.' }).screenshot({ path: testInfo.outputPath('visit-details.png'), animations: 'disabled' });
});

test('expired subscriptions retain the listing and send owners to billing', async ({ page }) => {
  await mockSite(page, { expired: true }); await page.goto('/place/moss-apothecary');
  await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Place', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Manage Subscription' }).click(); await expect(page).toHaveURL(/my-places/);
  await expect(page.getByText('Editing paused', { exact: true }).filter({ visible: true })).toBeVisible();
});

test('conflicting edits keep the draft and require reloading before publishing', async ({ page }) => {
  await mockSite(page, { conflict: true }); await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Tagline', { exact: true }).fill('Keep my changes');
  await dialog.getByRole('button', { name: 'Publish Changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Someone else updated');
  await expect(dialog.getByLabel('Tagline', { exact: true })).toHaveValue('Keep my changes');
  await expect(dialog.getByRole('button', { name: 'Publish Changes' })).toBeDisabled();
});

test('admins review claims and assign multiple manager emails', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('group', { name: 'Admin sections' }).getByRole('button', { name: 'Places', exact: true }).click(); await page.getByRole('button', { name: 'Manage', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Manager email addresses').fill('one@example.com, two@example.com');
  await dialog.getByRole('button', { name: 'Assign Access' }).click();
  await expect(dialog.getByText('one@example.com', { exact: true })).toBeVisible(); await expect(dialog.getByText('two@example.com', { exact: true })).toBeVisible();
  expect(state.assigned).toHaveLength(2); await page.screenshot({ path: testInfo.outputPath('admin.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Close place administration' }).click();
  await page.getByRole('button', { name: 'Claim Requests', exact: true }).click();
  page.once('dialog', confirmation => confirmation.accept());
  await page.getByRole('button', { name: 'Approve Claim' }).click();
  await expect.poll(() => state.reviewed?.p_approve).toBe(true);
});

test('ordinary accounts cannot enter the admin area', async ({ page }) => {
  await mockSite(page); await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('administrators');
  await expect(page.getByRole('button', { name: 'Claim Requests', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Place', exact: true })).toHaveCount(0);
});

test('claimed places never offer a new claim to guests or unrelated users', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' }); state.place.is_claimed = true;
  await page.goto('/place/moss-apothecary');
  await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim This Place' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Claim This Place' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Place', exact: true })).toHaveCount(0);
});

test('admin tables sort by headings and expose linked places and protected user removal', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  const table = page.getByRole('table', { name: 'Users', exact: true });
  await expect(table.getByRole('row').filter({ hasText: 'owner@example.com' })).toContainText('Moss Apothecary');
  await expect(table.getByRole('row').filter({ hasText: 'admin@example.com' }).getByRole('button', { name: 'Remove User' })).toBeDisabled();
  await expect(table.getByRole('row').filter({ hasText: 'billing@example.com' }).getByRole('button', { name: 'Remove User' })).toBeDisabled();
  await table.getByRole('button', { name: 'Email', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: /Email/ })).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(() => state.directoryRequests.at(-1)).toMatchObject({ p_section: 'users', p_sort: 'email', p_desc: true, p_page: 0 });
  await table.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: /Places/ })).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(() => state.directoryRequests.at(-1).p_sort).toBe('place_count');
  await page.screenshot({ path: testInfo.outputPath('admin-users.png'), fullPage: true, animations: 'disabled' });
  await table.getByRole('row').filter({ hasText: 'owner@example.com' }).getByRole('button', { name: 'Moss Apothecary' }).click();
  await expect(page.getByRole('dialog')).toContainText('Managers');
  await page.getByRole('button', { name: 'Close place administration' }).click();
  await page.getByRole('group', { name: 'Admin sections' }).getByRole('button', { name: 'Places', exact: true }).click();
  await page.getByRole('table', { name: 'Places', exact: true }).getByRole('button', { name: 'City', exact: true }).click();
  await expect.poll(() => state.directoryRequests.at(-1).p_sort).toBe('city');
});

test('user removal requires email confirmation, preserves errors, and refreshes after success', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'owner@example.com' }).getByRole('button', { name: 'Remove User' }).click();
  const dialog = page.getByRole('dialog'); const remove = dialog.getByRole('button', { name: 'Permanently Remove User' });
  await expect(dialog).toContainText('Moss Apothecary'); await expect(remove).toBeDisabled();
  await dialog.getByLabel('Type the user’s email to confirm').fill('wrong@example.com'); await expect(remove).toBeDisabled();
  await dialog.getByLabel('Type the user’s email to confirm').fill('owner@example.com');
  state.removalError = 'Reassign this user’s billing contact before removing the account.';
  await remove.click(); await expect(dialog.getByRole('alert')).toContainText('Reassign'); await expect(remove).toBeEnabled();
  state.removalError = ''; await remove.click(); await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'owner@example.com was removed.' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'owner@example.com' })).toHaveCount(0);
  expect(state.removed).toEqual({ action: 'remove', user_id: 'manager-1', email: 'owner@example.com' });
});

test('admins create places with custom URLs and links, then continue to photos', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('button', { name: 'Add Place', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Place name', { exact: true }).fill('Café Herb Shop');
  await expect(dialog.getByLabel('URL slug')).toHaveValue('cafe-herb-shop');
  await dialog.getByLabel('URL slug').fill('herbs-in-tucson');
  await dialog.getByLabel('Place name', { exact: true }).fill('Tucson Herb Shop');
  await expect(dialog.getByLabel('URL slug')).toHaveValue('herbs-in-tucson');
  await dialog.getByLabel('City', { exact: true }).fill('Tucson');
  await dialog.getByLabel('State or region').fill('AZ');
  await dialog.getByLabel('Description', { exact: true }).fill('A new community herb shop.');
  await dialog.getByRole('checkbox', { name: 'Herb Shops & Apothecaries' }).check();
  await dialog.getByRole('button', { name: 'Add Link', exact: true }).click();
  await dialog.getByLabel('Link text', { exact: true }).fill('Our menu');
  await dialog.getByLabel('Link URL', { exact: true }).fill('example.com/menu');
  await dialog.getByRole('button', { name: 'Preview Changes' }).click();
  await expect(dialog.getByRole('region', { name: 'Place preview' })).toContainText('Tucson Herb Shop');
  await page.screenshot({ path: testInfo.outputPath('add-place.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Create Place & Add Photos' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit Tucson Herb Shop' })).toBeVisible();
  expect(state.created.p_slug).toBe('herbs-in-tucson');
  expect(state.created.p_content.social_links).toEqual([{ label: 'Our menu', url: 'https://example.com/menu' }]);
  expect(state.created.p_content.category_ids).toEqual(['shops']);
  expect(state.created.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
  await dialog.getByLabel('Add photos').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=', 'base64') });
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Publish Changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'View Tucson Herb Shop' }).click();
  await expect(page).toHaveURL(/place\/herbs-in-tucson/);
  await expect(page.getByRole('heading', { name: 'Tucson Herb Shop', exact: true })).toBeVisible();
});

test('creation errors keep the draft and reuse the request ID on retry', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('button', { name: 'Add Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Place name', { exact: true }).fill('Another Shop');
  state.creationError = 'This URL is already in use. Choose another public URL.';
  await dialog.getByRole('button', { name: 'Create Place & Add Photos' }).click();
  await expect(dialog.getByRole('alert')).toContainText('already in use');
  await expect(dialog.getByLabel('Place name', { exact: true })).toHaveValue('Another Shop');
  await dialog.getByLabel('URL slug').fill('another-shop-denver');
  state.creationError = '';
  await dialog.getByRole('button', { name: 'Create Place & Add Photos' }).click();
  await expect(dialog.getByRole('heading', { name: 'Edit Another Shop' })).toBeVisible();
  expect(state.creationAttempts[0].p_request_id).toBe(state.creationAttempts[1].p_request_id);
});

test('canceling a new place makes no listing', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' }); await page.goto('/admin');
  await page.getByRole('button', { name: 'Add Place', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Place name', { exact: true }).fill('Discard this place');
  page.once('dialog', confirmation => confirmation.accept()); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible(); expect(state.created).toBeUndefined();
});

test('place visit details label address and phone and list different opening days', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  state.place.phone = '303-555-0142';
  state.place.hours = 'Monday–Friday: 10am–6pm; Saturday: 11am–5pm; Sunday: closed';
  await page.goto('/place/moss-apothecary');
  const visit = page.getByRole('complementary', { name: 'Plan a Little Visit.' });
  await expect(visit.getByRole('heading', { name: 'Address', exact: true })).toBeVisible();
  await expect(visit.getByRole('heading', { name: 'Phone', exact: true })).toBeVisible();
  await expect(visit.getByRole('link', { name: state.place.phone })).toHaveAttribute('href', `tel:${state.place.phone}`);
  await expect(visit.getByRole('listitem')).toHaveText(['Monday–Friday: 10am–6pm', 'Saturday: 11am–5pm', 'Sunday: closed']);
});

test('homepage pins open place details directly and leave no place preview card', async ({ page }, testInfo) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/');
  await expect(page.locator('#hero-place-preview')).toHaveCount(0);
  await expect(page.getByRole('navigation').first()).toHaveCSS('border-bottom-width', '0px');
  await expect(page.getByRole('link', { name: 'Open the Full Map' })).toHaveAttribute('href', '/map?view=map');
  await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Visit Moss Apothecary' }).click();
  await expect(page).toHaveURL(/place\/moss-apothecary$/);
  await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
});

for (const start of ['/', '/map?category=shops&q=Herbal']) {
  test(`nearby discovery from ${start} explains permission first and filters map and list after consent`, async ({ page, context }, testInfo) => {
    const state = await mockSite(page, { role: 'guest' });
    state.extraPlaces = [{ ...makePlace(), id: 'far', name: 'Distant Garden', urlSlug: 'distant-garden', latitude: 30.27, longitude: -97.74 }];
    await context.setGeolocation({ latitude: 39.7, longitude: -104.9 });
    await context.grantPermissions(['geolocation']);
    await page.addInitScript(() => {
      window.locationRequests = 0;
      const queryPermission = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = descriptor => descriptor.name === 'geolocation' ? Promise.resolve({ state: 'prompt' }) : queryPermission(descriptor);
      const getPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...args) => { window.locationRequests++; getPosition(...args); };
    });
    await page.goto(start);
    if (start.startsWith('/map')) {
      const filters = page.getByRole('group', { name: 'Kind of place' }).getByRole('button');
      await expect(filters.nth(0)).toHaveText('All Places');
      await expect(filters.nth(1)).toHaveAccessibleName('Places Near Me');
    }
    await page.getByRole('button', { name: 'Places Near Me' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Your browser will ask to share your location.');
    await expect(dialog).toContainText('within 50 miles');
    expect(await page.evaluate(() => window.locationRequests)).toBe(0);
    await dialog.screenshot({ path: testInfo.outputPath('location-prompt.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Use My Location' }).click();
    await expect(page).toHaveURL(/view=map&lat=39.700&lng=-104.900/);
    if (start.startsWith('/map')) {
      const params = new URL(page.url()).searchParams;
      expect(params.get('category')).toBe('shops');
      expect(params.get('q')).toBe('Herbal');
    }
    await expect(page.getByText('Showing places within 50 miles of your location.')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Map results' }).getByText('Distant Garden', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Distant Garden', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show Places Everywhere' }).click();
    await expect(page.getByRole('heading', { name: 'Distant Garden', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/lat=/);
  });
}

for (const code of [1, 2, 3]) {
  test(`nearby discovery handles location failure ${code} and offers manual exploration`, async ({ page }) => {
    await mockSite(page, { role: 'guest' });
    await page.addInitScript(code => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code }); }, code);
    await page.goto('/');
    await page.getByRole('button', { name: 'Places Near Me' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Use My Location' }).click();
    await expect(dialog.getByRole('alert')).toContainText(code === 1 ? 'wasn’t allowed' : 'couldn’t find');
    await dialog.getByRole('link', { name: 'Explore the Map' }).click();
    await expect(page).toHaveURL(/map\?view=map$/);
  });
}

test('canceling nearby discovery prevents a late location response from navigating', async ({ page }) => {
  await mockSite(page, { role: 'guest' });
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = success => { window.finishLocation = success; }; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Places Near Me' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Use My Location' }).click();
  await page.getByRole('button', { name: 'Keep Browsing', exact: true }).click();
  await page.evaluate(() => window.finishLocation({ coords: { latitude: 39.7, longitude: -104.9 } }));
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('My Places is separate from saved places and preserves old billing return links', async ({ page }, testInfo) => {
  const state = await mockSite(page);
  state.favorites = [{ item_id: 'place-1' }];
  await page.goto('/favorites?billing=returned&place=place-1#my-places');
  await expect(page).toHaveURL(/my-places\?billing=returned&place=place-1/);
  await expect(page.getByRole('heading', { name: 'My Places', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toHaveCount(0);
  await expect(page.getByRole('main', { name: 'My Places', exact: true }).getByRole('link', { name: 'View & Edit Place' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Bloom is active for Moss Apothecary.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open menu' });
  const mobileMenu = await menu.isVisible();
  if (mobileMenu) await menu.click();
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'My Places', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'For Business Owners', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').first().locator('button[aria-controls]:not([aria-controls="main-navigation"])').click();
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'My Places', exact: true })).toBeVisible();
  if (mobileMenu) await page.getByRole('button', { name: 'Close menu' }).click();
  await page.screenshot({ path: testInfo.outputPath('my-places-page.png'), fullPage: true, animations: 'disabled' });
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moss Apothecary', exact: true })).toBeVisible();
  await expect(page.getByRole('main', { name: 'My Places', exact: true })).toHaveCount(0);
});

test('pending claimants get My Places while people only saving places do not', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'claimant' });
  state.claims.push({ id: 'claim-1', place_id: 'place-1', name: state.place.name, urlSlug: state.place.urlSlug, status: 'pending' });
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'My Places', exact: true })).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').first().locator('button[aria-controls]:not([aria-controls="main-navigation"])').click();
  await page.getByRole('navigation').first().getByRole('link', { name: 'My Places', exact: true }).click();
  await expect(page.getByRole('main', { name: 'My Places', exact: true })).toContainText('Pending review');
  state.claims = [];
  await page.reload();
  await expect(page).toHaveURL(/favorites$/);
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Places', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Request a Listing', exact: true }).and(page.locator('main a'))).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('saved-places-only.png'), fullPage: true, animations: 'disabled' });
});

test('guests cannot open a claim modal for an already claimed place', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' }); state.place.is_claimed = true;
  await page.goto('/place/moss-apothecary?claim=1');
  await expect(page.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim This Place' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const start of ['/', '/map?category=shops']) {
  test(`existing location permission from ${start} skips the prompt and marks the map`, async ({ page, context }, testInfo) => {
    await mockSite(page, { role: 'guest' });
    await context.setGeolocation({ latitude: 39.7, longitude: -104.9 });
    await context.grantPermissions(['geolocation']);
    await page.route('**/src/utilities/mapConfig.js', route => route.fulfill({ contentType: 'application/javascript', body: 'export const MAPBOX_TOKEN = "pk.browser-test-token";' }));
    await page.route('https://api.mapbox.com/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf0e6' } }] } }));
    await page.route('https://events.mapbox.com/**', route => route.fulfill({ status: 204 }));
    await page.addInitScript(() => {
      window.locationDialogs = 0;
      const showModal = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function () { window.locationDialogs++; return showModal.call(this); };
    });
    await page.goto(start);
    await expect(page.getByRole('button', { name: 'Places Near Me' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Places Near Me' }).click();
    await expect(page).toHaveURL(/view=map&lat=39.700&lng=-104.900/);
    expect(await page.evaluate(() => window.locationDialogs)).toBe(0);
    await expect(page.getByRole('img', { name: 'Your approximate location' })).toBeVisible();
    await expect(page.getByText('You are here', { exact: true })).toBeVisible();
    const nearbyChip = page.getByRole('button', { name: 'Places Near Me' });
    await expect(nearbyChip).toHaveAttribute('aria-pressed', 'true');
    await expect(nearbyChip).toHaveCSS('border-color', 'rgb(44, 84, 47)');
    await page.getByRole('img', { name: 'Your approximate location' }).screenshot({ path: testInfo.outputPath('user-location-pin.png'), animations: 'disabled' });
    await nearbyChip.click();
    await expect(nearbyChip).toHaveAttribute('aria-pressed', 'false');
    await expect(page).not.toHaveURL(/lat=/);
    await expect(page.getByRole('img', { name: 'Your approximate location' })).toHaveCount(0);
    if (start.startsWith('/map')) expect(new URL(page.url()).searchParams.get('category')).toBe('shops');
    await nearbyChip.click();
    await expect(nearbyChip).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'All Places', exact: true }).click();
    await expect(nearbyChip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'All Places', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/lat=|category=/);
  });
}

test('previously allowed location failures stay inline without opening the prompt', async ({ page, context }) => {
  await mockSite(page, { role: 'guest' });
  await context.grantPermissions(['geolocation']);
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 3 }); });
  await page.goto('/map');
  await page.getByRole('button', { name: 'Places Near Me' }).click();
  await expect(page.getByRole('alert')).toContainText('couldn’t find your location');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Places Near Me' })).toBeEnabled();
});

test('homepage grouped pins open the map fitted to all places in the group', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  state.extraPlaces = [
    { ...makePlace(), id: 'fern', name: 'Fern Garden', urlSlug: 'fern-garden', latitude: 39.72, longitude: -104.88 },
    { ...makePlace(), id: 'distant', name: 'Distant Garden', urlSlug: 'distant-garden', latitude: 30.27, longitude: -97.74 },
  ];
  await page.route('**/src/utilities/mapConfig.js', route => route.fulfill({ contentType: 'application/javascript', body: 'export const MAPBOX_TOKEN = "pk.browser-test-token";' }));
  await page.route('https://api.mapbox.com/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf0e6' } }] } }));
  await page.route('https://events.mapbox.com/**', route => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore 2 places in this area' }).click();
  await expect(page).toHaveURL(/map\?view=map&bounds=/);
  expect(new URL(page.url()).searchParams.get('bounds')).toBe('-104.9,39.7,-104.88,39.72');
  const map = page.getByRole('region', { name: 'Explore places on the map' });
  await expect.poll(() => map.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(20);
  await expect(map.getByRole('button', { name: 'View Moss Apothecary on Map', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: 'View Fern Garden on Map', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: 'View Distant Garden on Map', exact: true })).toHaveCount(0);
  await expect(page.locator('#discover-place-preview')).toHaveCount(0);
});

test('directory pagination limits lists and map results to 15 and resets with filters', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'guest' });
  state.extraPlaces = Array.from({ length: 30 }, (_, index) => ({ ...makePlace(), id: `place-${index + 2}`, name: `Test Place ${String(index + 2).padStart(2, '0')}`, urlSlug: `test-place-${index + 2}` }));
  await page.goto('/map?category=shops&q=Herbal');
  const main = page.getByRole('main');
  const pagination = page.getByRole('navigation', { name: 'Places pagination' });
  await expect(main.getByRole('article')).toHaveCount(15);
  await expect(pagination).toContainText('Showing 1–15 of 31 places');
  await expect(pagination.getByRole('button', { name: 'Previous Page' })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Next Page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(main.getByRole('article')).toHaveCount(15);
  await expect(pagination).toContainText('Showing 16–30 of 31 places');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const results = page.getByRole('complementary', { name: 'Map results' });
  await expect(results).toBeVisible();
  const browse = results.getByRole('button', { name: /Browse 31 Places/ });
  if (await browse.isVisible()) await browse.click();
  await expect(results.getByRole('button', { name: /^Show .* on Map$/ })).toHaveCount(15);
  await expect(pagination).toContainText('Page 2 of 3');
  await pagination.getByRole('button', { name: 'Next Page' }).click();
  await expect(results.getByRole('button', { name: /^Show .* on Map$/ })).toHaveCount(1);
  await expect(pagination.getByRole('button', { name: 'Next Page' })).toBeDisabled();
  await results.screenshot({ path: testInfo.outputPath('map-pagination.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(main.getByRole('article')).toHaveCount(1);
  await expect(pagination).toContainText('Page 3 of 3');
  await page.reload();
  await expect(main.getByRole('article')).toHaveCount(1);
  await page.getByRole('searchbox').fill('Test Place 03');
  await expect(main.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Test Place 03', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/page=/);
  await expect(pagination).toHaveCount(0);
});

test('map pins select results beyond the current pagination page', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  state.extraPlaces = Array.from({ length: 30 }, (_, index) => ({ ...makePlace(), id: `place-${index + 2}`, name: `Test Place ${String(index + 2).padStart(2, '0')}`, urlSlug: `test-place-${index + 2}`, longitude: -104.9 + (index + 1) * .03 }));
  await page.route('**/src/utilities/mapConfig.js', route => route.fulfill({ contentType: 'application/javascript', body: 'export const MAPBOX_TOKEN = "pk.browser-test-token";' }));
  await page.route('https://api.mapbox.com/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf0e6' } }] } }));
  await page.route('https://events.mapbox.com/**', route => route.fulfill({ status: 204 }));
  await page.goto('/map?view=map&bounds=-104.005,39.695,-103.995,39.705');
  await page.getByRole('button', { name: 'View Test Place 31 on Map', exact: true }).click();
  await expect(page).toHaveURL(/page=3/);
  const results = page.getByRole('complementary', { name: 'Map results' });
  await expect(results).toBeVisible();
  const browse = results.getByRole('button', { name: /Browse 31 Places/ });
  if (await browse.isVisible()) await browse.click();
  await expect(results.getByRole('button', { name: /^Show .* on Map$/ })).toHaveCount(1);
  await expect(results.getByRole('button', { name: 'Show Test Place 31 on Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Search This Area', exact: true }).click();
  await expect(page).not.toHaveURL(/page=/);
});

test('account recovery sends safe return links and preserves errors for retry', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/auth/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  state.authError = 'Please wait before requesting another email.';
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByRole('alert')).toContainText('Please wait');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('owner@example.com');
  state.authError = '';
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  expect(state.authRequests.find(request => request.url.includes('/recover')).url).toContain(encodeURIComponent('/auth/reset-password'));
  await page.goto('/auth/resend-confirmation?next=%2Fplace%2Fmoss-apothecary%3Fclaim%3D1');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByRole('button', { name: 'Send Confirmation Email' }).click();
  await expect(page.getByRole('status')).toContainText('If this address is waiting');
  const resend = state.authRequests.find(request => request.url.includes('/resend'));
  expect(new URL(resend.url).searchParams.get('redirect_to')).toContain('next=%2Fplace%2Fmoss-apothecary%3Fclaim%3D1');
});

test('password updates require a session and matching new passwords', async ({ page }) => {
  const state = await mockSite(page);
  await page.goto('/auth/reset-password');
  await page.getByLabel('New password', { exact: true }).fill('new-password-123');
  await page.getByLabel('Confirm new password').fill('different-password');
  await page.getByRole('button', { name: 'Save New Password' }).click();
  await expect(page.getByRole('alert')).toContainText('don’t match');
  expect(state.authRequests.filter(request => request.method === 'PUT')).toHaveLength(0);
  await page.getByLabel('Confirm new password').fill('new-password-123');
  await page.getByRole('button', { name: 'Save New Password' }).click();
  await expect(page.getByRole('status')).toContainText('password has been updated');
  expect(state.authRequests.find(request => request.method === 'PUT').body.password).toBe('new-password-123');
});

test('expired password recovery links offer a fresh request', async ({ page }) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/auth/reset-password');
  await expect(page.getByRole('alert')).toContainText('Open the link');
  await expect(page.getByRole('link', { name: 'Request a New Link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save New Password' })).toHaveCount(0);
});

test('rejected claims and access failures remain visible with recovery actions', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' });
  state.claims.push({ id: 'rejected-1', place_id: 'place-1', name: state.place.name, urlSlug: state.place.urlSlug, status: 'rejected', review_note: 'Please use your business email.' });
  await page.goto('/my-places');
  const section = page.getByRole('main', { name: 'My Places', exact: true });
  await expect(section.getByText('Please use your business email.', { exact: true })).not.toBeVisible();
  await section.locator('summary').filter({ hasText: 'Past requests' }).click();
  await expect(section).toContainText('Please use your business email.');
  await expect(section.getByRole('link', { name: 'return to the listing to submit updated details' })).toBeVisible();
  state.managementError = 'Unable to load place access.';
  await section.getByRole('button', { name: 'Refresh Access' }).click();
  await expect(section.getByRole('alert')).toContainText('Unable to load');
  await expect(section).toContainText('Please use your business email.');
  state.managementError = '';
  await section.getByRole('button', { name: 'Refresh Access' }).click();
  await expect(section.getByRole('alert')).toHaveCount(0);
});

test('claim details survive an email confirmation in another browser tab', async ({ page, context }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Claim This Place' }).click();
  const dialog = await fillClaim(page);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Sign In to Send Claim' }).click();
  expect(state.claims).toHaveLength(0);
  const second = await context.newPage();
  await mockSite(second, { role: 'claimant' });
  await second.goto('/auth/callback?next=%2Fplace%2Fmoss-apothecary%3Fclaim%3D1');
  await expect(second).toHaveURL(/moss-apothecary\?claim=1/);
  await expect(second.getByRole('dialog').getByLabel('Your full name')).toHaveValue('Jamie Green');
  await second.close();
});

test('listing requests survive a failed submission and show their saved status', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'claimant' });
  await page.goto('/request-place');
  await page.getByLabel('Place name', { exact: true }).fill('New Herb Shop');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByText('More details (optional)', { exact: true }).click();
  await page.getByLabel('Website (optional)').fill('https://example.com');
  state.listingError = 'Please try again shortly.';
  await page.getByRole('button', { name: 'Send Listing Request' }).click();
  await expect(page.getByRole('alert')).toContainText('try again');
  await expect(page.getByLabel('Place name', { exact: true })).toHaveValue('New Herb Shop');
  state.listingError = '';
  await page.getByRole('button', { name: 'Send Listing Request' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'listing request is saved' })).toBeVisible();
  await expect(page.getByRole('list').filter({ hasText: 'New Herb Shop' })).toContainText('Pending review');
  expect(state.listingAttempts[0].p_request_id).toBe(state.listingAttempts[1].p_request_id);
  await page.screenshot({ path: testInfo.outputPath('listing-request.png'), fullPage: true });
});

test('admins can link a requested listing without approving ownership', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' });
  state.listingRequests.push({ id: 'request-1', name: 'Moss Apothecary', city: 'Denver', region: 'CO', email: 'owner@example.com', notes: 'Please add our shop.', status: 'pending', created_at: new Date().toISOString() });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Listing Requests', exact: true }).click();
  await page.getByLabel('Choose an existing place').selectOption('moss-apothecary');
  await page.getByLabel('Review note (visible to requester)').fill('Your listing is ready. Please submit your ownership claim.');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Link Listing & Notify' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Listing request reviewed' })).toBeVisible();
  expect(state.reviewedListing.p_slug).toBe('moss-apothecary');
  expect(state.reviewed).toBeUndefined();
});

test('unpublished editor drafts recover after reload without overwriting newer content', async ({ page }) => {
  const state = await mockSite(page);
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  await page.getByLabel('Tagline', { exact: true }).fill('Recovered tagline');
  await page.reload();
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('draft was recovered');
  await expect(page.getByLabel('Tagline', { exact: true })).toHaveValue('Recovered tagline');
  state.place.content_version = 2;
  await page.reload();
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('published listing has changed');
  await expect(page.getByRole('button', { name: 'Publish Changes' })).toBeDisabled();
});

test('published edits remain successful when directory refresh fails', async ({ page }) => {
  const state = await mockSite(page);
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  await page.getByLabel('Tagline', { exact: true }).fill('Saved despite refresh failure');
  state.refreshError = true;
  await page.getByRole('button', { name: 'Publish Changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Your changes are saved.' })).toBeVisible();
  expect(state.published.p_content.tagline).toBe('Saved despite refresh failure');
});

test('business plans explain purchase timing and keep newsletter signup distinct', async ({ page }, testInfo) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden');
  await expect(page.getByText('Claiming is free and ownership approval comes before payment.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Thrive', exact: true })).toBeVisible();
  await expect(page.getByText('Verified Place Badge', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('business-plans.png'), fullPage: true });
  await page.goto('/the-little-garden/sprout');
  await expect(page.getByText('This newsletter signup does not create a website account', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscribe to Updates' })).toBeVisible();
});

test('renewing owners keep editing while their cycle invoice processes', async ({ page }) => {
  await mockSite(page,{renewalProcessing:true});
  await page.goto('/my-places');
  await expect(page.getByText('Renewal processing',{exact:true}).filter({ visible: true })).toBeVisible();
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Place',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});


test('Bloom starts an inline claim and resumes in the guided flow after sign-in', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/bloom');
  await page.getByRole('link', { name: 'Get Started with Bloom', exact: true }).first().click();
  await expect(page).toHaveURL(/the-little-garden\/start\?plan=bloom$/);
  await page.getByRole('searchbox', { name: 'Business name or city', exact: true }).fill('Moss');
  await page.getByRole('button', { name: 'Continue with Moss Apothecary', exact: true }).click();
  let dialog = await fillClaim(page);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Sign In to Send Claim' }).click();
  const destination = new URL(page.url()).searchParams.get('next');
  expect(destination).toBe('/the-little-garden/start?plan=bloom&place=moss-apothecary&claim=1');
  await page.getByLabel('Email', { exact: true }).fill('guest@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password-for-test');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/the-little-garden\/start\?plan=bloom&place=moss-apothecary&claim=1/);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Your full name')).toHaveValue('Jamie Green');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View Claim Status', exact: true })).toBeVisible();
  expect(state.claims).toHaveLength(1);
  await expect(page).not.toHaveURL(/claim=1/);
});

test('missing-place flow combines existing-account sign-in and request submission', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/start?plan=bloom');
  await page.getByRole('searchbox', { name: 'Business name or city', exact: true }).fill('New Fern');
  await expect(page.getByText('No matching listings. You can request yours below.')).toBeVisible();
  await page.getByRole('button', { name: 'Add My Place', exact: true }).click();
  await page.getByLabel('Place name', { exact: true }).fill('New Fern Apothecary');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Already have an account? Sign in here', exact: true }).click();
  await page.getByLabel('Account email', { exact: true }).fill('guest@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password-for-test');
  await page.getByRole('button', { name: 'Sign In & Send Request', exact: true }).click();
  await expect(page).toHaveURL(/the-little-garden\/start\?plan=bloom&new=1/);
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  expect(state.listingRequests).toHaveLength(1);
  expect(state.listingRequests[0].name).toBe('New Fern Apothecary');
});

test('guided start recognizes existing access and avoids duplicate claims', async ({ page }) => {
  await mockSite(page, { role: 'owner' });
  await page.goto('/the-little-garden/start?plan=bloom&place=moss-apothecary&claim=1');
  await expect(page.getByRole('link', { name: 'Continue to My Places', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('guided start routes pending claims and claimed places to their next step', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' });
  state.claims.push({ id: 'claim-1', place_id: 'place-1', status: 'pending' });
  await page.goto('/the-little-garden/start?plan=bloom&place=moss-apothecary&claim=1');
  await expect(page.getByRole('link', { name: 'View Claim Status', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  state.claims = []; state.place.is_claimed = true;
  await page.reload();
  await expect(page.getByRole('link', { name: 'Get Help with Access', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Thrive starts with a place while keeping upcoming availability clear', async ({ page }) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/thrive');
  await page.getByRole('link', { name: 'Start with Your Place', exact: true }).first().click();
  await expect(page).toHaveURL(/the-little-garden\/start\?plan=thrive$/);
  await expect(page.getByText('Thrive is coming soon.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ask about Thrive', exact: true })).toHaveAttribute('href', /^mailto:/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


async function fillListingAndAccount(page) {
  await page.getByLabel('Place name', { exact: true }).fill('New Fern Apothecary');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Account email', { exact: true }).fill('newfern@example.com');
  await page.getByLabel('Create a password', { exact: true }).fill('private-test-password');
  await page.getByRole('checkbox', { name: 'I agree to the membership terms', exact: false }).check();
}

test('new accounts send a listing request from the same form without storing credentials', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/start?plan=thrive&new=1');
  await fillListingAndAccount(page);
  await page.getByRole('button', { name: 'Create Account & Send Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  expect(state.listingRequests).toHaveLength(1);
  expect(state.authRequests.filter(request => request.url.includes('/signup'))).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify([localStorage.getItem('little-herb-listing-request-confirmation'), sessionStorage.getItem('little-herb-listing-request')]))).not.toContain('private-test-password');
  await expect(page).toHaveURL(/start\?plan=thrive&new=1/);
});

test('email confirmation preserves a listing draft in another tab and requires explicit submission', async ({ page, context }) => {
  const state = await mockSite(page, { role: 'guest' });
  state.signupNeedsConfirmation = true;
  await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await fillListingAndAccount(page);
  await page.getByRole('button', { name: 'Create Account & Send Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your request has not been sent' })).toBeVisible();
  expect(state.listingRequests).toHaveLength(0);
  const saved = await page.evaluate(() => localStorage.getItem('little-herb-listing-request-confirmation'));
  expect(saved).toContain('New Fern Apothecary');
  expect(saved).not.toContain('private-test-password');
  const confirmedTab = await context.newPage();
  const confirmed = await mockSite(confirmedTab, { role: 'claimant' });
  await confirmedTab.goto('/the-little-garden/start?plan=bloom&new=1');
  await expect(confirmedTab.getByLabel('Place name', { exact: true })).toHaveValue('New Fern Apothecary');
  expect(confirmed.listingRequests).toHaveLength(0);
  await confirmedTab.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
  await expect(confirmedTab.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  expect(await confirmedTab.evaluate(() => localStorage.getItem('little-herb-listing-request-confirmation'))).toBeNull();
});

test('a request can retry after account creation without creating another account', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  state.listingError = 'Please try sending your request again.';
  await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await fillListingAndAccount(page);
  await page.getByRole('button', { name: 'Create Account & Send Request', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please try sending your request again.' })).toBeVisible();
  await expect(page.getByText('New Fern Apothecary', { exact: true })).toBeVisible();
  state.listingError = '';
  await page.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  expect(state.authRequests.filter(request => request.url.includes('/signup'))).toHaveLength(1);
  expect(state.listingAttempts[0].p_request_id).toBe(state.listingAttempts[1].p_request_id);
});


test('listing signup shows one step at a time and keeps details when going back', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByLabel('Account email', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Anything we should know? (optional)')).not.toBeVisible();
  await page.getByLabel('Place name', { exact: true }).fill('Quiet Garden');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Place name', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Account email', { exact: true })).toBeVisible();
  await expect(page.getByText('Quiet Garden', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Place name', { exact: true })).toHaveValue('Quiet Garden');
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Boulder');
  expect(state.listingRequests).toHaveLength(0);
  expect(state.authRequests.filter(request => request.url.includes('/signup'))).toHaveLength(0);
});


test('listing websites accept bare and international domains and store complete web URLs', async ({ page }) => {
  const state = await mockSite(page, { role: 'claimant' });
  for (const [entered, stored] of [['shop.example.herbal', 'https://shop.example.herbal/'], ['例え.テスト/path', 'https://xn--r8jz45g.xn--zckzah/path'], ['shop.example:8443', 'https://shop.example:8443/']]) {
    await page.goto('/request-place');
    await page.getByLabel('Place name', { exact: true }).fill('Quiet Garden');
    await page.getByLabel('City', { exact: true }).fill('Boulder');
    await page.getByText('More details (optional)', { exact: true }).click();
    await page.getByLabel('Website (optional)', { exact: true }).fill(entered);
    await page.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
    expect(state.listingAttempts.at(-1).p_website).toBe(stored);
  }
});

test('invalid websites are explained before signup and can be corrected or omitted', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await page.getByLabel('Place name', { exact: true }).fill('Quiet Garden');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByText('More details (optional)', { exact: true }).click();
  await page.getByLabel('Website (optional)', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a website');
  expect(state.authRequests.filter(request => request.url.includes('/signup'))).toHaveLength(0);
  await page.getByLabel('Website (optional)', { exact: true }).fill('shop.example.herbal');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Account email', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByText('More details (optional)', { exact: true }).click();
  await expect(page.getByLabel('Website (optional)', { exact: true })).toHaveValue('https://shop.example.herbal/');
});

test('a listing request keeps its street address and postal code through signup', async ({ page }) => {
  const state = await mockSite(page, { role: 'guest' });
  await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await page.getByLabel('Place name', { exact: true }).fill('New Fern Apothecary');
  await page.getByLabel('Street address (optional)', { exact: true }).fill('123 Main Street');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByLabel('State or region', { exact: true }).fill('CO');
  await page.getByText('More details (optional)', { exact: true }).click();
  await page.getByLabel('Postal code (optional)', { exact: true }).fill('80301');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('123 Main Street, Boulder, CO, 80301', { exact: true })).toBeVisible();
  await page.getByLabel('Account email', { exact: true }).fill('newfern@example.com');
  await page.getByLabel('Create a password', { exact: true }).fill('private-test-password');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create Account & Send Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  expect(state.listingAttempts[0].p_address).toBe('123 Main Street');
  expect(state.listingAttempts[0].p_zip).toBe('80301');
});

test('processing a listing request prefills the address and starts server geocoding', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' });
  state.listingRequests.push({ id: 'request-1', name: 'New Fern Apothecary', address: '123 Main Street', city: 'Boulder', region: 'CO', zip: '80301', website: '', notes: '', email: 'owner@example.com', status: 'pending', created_at: new Date().toISOString() });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Listing Requests', exact: true }).click();
  await expect(page.getByText('123 Main Street, Boulder, CO, 80301 · owner@example.com', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create Listing', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Street address', { exact: true })).toHaveValue('123 Main Street');
  await expect(dialog.getByLabel('ZIP or postal code', { exact: true })).toHaveValue('80301');
  await dialog.getByRole('button', { name: 'Create Place & Add Photos', exact: true }).click();
  await expect.poll(() => state.geocodedPlace).toBe('place-new');
  expect(state.created.p_content.address).toBe('123 Main Street');
  expect(state.created.p_content.zip).toBe('80301');
});


test('signed-in listing requests appear before the form with clear pending and listed actions', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'claimant' });
  state.listingRequests = [
    { id: 'request-pending', name: 'Fern & Field', address: '12 Garden Lane', city: 'Boulder', region: 'CO', status: 'pending', created_at: '2026-10-21T12:00:00Z' },
    { id: 'request-listed', name: 'Moss Apothecary', address: '123 Main Street', city: 'Denver', region: 'CO', status: 'listed', place_slug: 'moss-apothecary', review_note: 'Your listing is ready. Claim it when you’re ready.', created_at: '2026-10-20T12:00:00Z' },
  ];
  await page.goto('/request-place');
  const requests = page.getByRole('region', { name: 'Your Listing Requests', exact: true });
  await expect(requests.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Your Listing Requests', exact: true })).toBeFocused();
  await expect(requests.getByRole('article').filter({ hasText: 'Fern & Field' })).toContainText('Pending review');
  const listed = requests.getByRole('article').filter({ hasText: 'Moss Apothecary' });
  await expect(listed).toContainText('Listed');
  await expect(listed).toContainText('Your listing is ready. Claim it when you’re ready.');
  await expect(listed.getByRole('link', { name: 'Start Your Claim', exact: true })).toHaveAttribute('href', '/place/moss-apothecary?claim=1');
  await expect(listed.getByRole('link', { name: 'View Listing', exact: true })).toHaveAttribute('href', '/place/moss-apothecary');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const requestsTop = await requests.evaluate(element => element.getBoundingClientRect().top);
  const formTop = await page.locator('#new-listing').evaluate(element => element.getBoundingClientRect().top);
  expect(requestsTop).toBeLessThan(formTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await requests.screenshot({ path: testInfo.outputPath('listing-request-cards.png') });
});

test('listed requests take approved managers to their place without a second claim', async ({ page }) => {
  const state = await mockSite(page, { role: 'owner' });
  state.listingRequests = [{ id: 'request-listed', name: 'Moss Apothecary', city: 'Denver', status: 'listed', place_slug: 'moss-apothecary', created_at: new Date().toISOString() }];
  await page.goto('/request-place');
  await expect(page.getByRole('link', { name: 'Manage Your Place', exact: true })).toHaveAttribute('href', '/my-places');
  await expect(page.getByRole('link', { name: 'Start Your Claim', exact: true })).toHaveCount(0);
});


test('My Places prioritizes the managed place, removes approved duplicates, and refreshes new requests', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'owner' });
  state.listingRequests = [
    { id: 'listed', name: 'Moss Apothecary', city: 'Denver', status: 'listed', place_slug: 'moss-apothecary', created_at: '2026-10-20T12:00:00Z' },
    { id: 'pending', name: 'Fern & Field', city: 'Boulder', status: 'pending', created_at: '2026-10-21T12:00:00Z' },
  ];
  await page.goto('/my-places');
  const places = page.getByRole('main', { name: 'My Places', exact: true });
  const requests = places.getByRole('region', { name: 'Other places in progress', exact: true });
  await expect(requests.getByRole('article')).toHaveCount(1);
  await expect(requests.getByRole('article').first()).toContainText('Fern & Field');
  await expect(requests.getByRole('article').first()).toContainText('Pending review');
  await expect(requests.getByRole('link', { name: 'Start Your Claim', exact: true })).toHaveCount(0);
  const requestTop = await requests.evaluate(element => element.getBoundingClientRect().top);
  const approvedTop = await places.getByRole('article').filter({ hasText: 'Ownership approved' }).evaluate(element => element.getBoundingClientRect().top);
  expect(approvedTop).toBeLessThan(requestTop);
  await expect(places.getByRole('heading', { name: 'Moss Apothecary', exact: true })).toHaveCount(1);
  await places.screenshot({ path: testInfo.outputPath('my-places-requests.png') });
  await places.getByRole('link', { name: 'Request a Listing', exact: true }).click();
  await page.getByRole('textbox', { name: 'Place name', exact: true }).fill('New Garden Shop');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  // Return through the app without reloading the management provider.
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').first().locator('button[aria-controls]:not([aria-controls="main-navigation"])').click();
  await page.getByRole('navigation').first().getByRole('link', { name: 'My Places', exact: true }).click();
  await expect(places.getByRole('article').filter({ hasText: 'New Garden Shop' })).toContainText('Pending review');
  state.claims.push({ id: 'new-claim', place_id: 'place-2', name: 'Another Herb Place', urlSlug: 'another-herb-place', status: 'pending' });
  await places.getByRole('button', { name: 'Refresh Access', exact: true }).click();
  await expect(places.getByRole('article').filter({ hasText: 'Another Herb Place' })).toContainText('Pending review');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('a first listing request adds My Places to navigation without adding management to saved places', async ({ page }) => {
  await mockSite(page, { role: 'claimant' });
  await page.goto('/request-place');
  await expect(page.getByRole('heading', { name: 'Your Listing Requests', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Places', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Place name', exact: true }).fill('Fern & Field');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your listing request is saved' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').first().locator('button[aria-controls]:not([aria-controls="main-navigation"])').click();
  await page.getByRole('navigation').first().getByRole('link', { name: 'My Places', exact: true }).click();
  await expect(page).toHaveURL(/my-places$/);
  await expect(page.getByRole('heading', { name: 'My Places', level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Fern & Field');
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').first().getByRole('link', { name: 'Liked Places', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Places', exact: true })).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText('Fern & Field');
});


test('a single owner gets one place card with older decisions tucked into history', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'owner' });
  state.listingRequests = [{ id: 'listed', name: state.place.name, status: 'listed', place_slug: state.place.urlSlug }];
  state.claims = [
    { id: 'approved', place_id: 'place-1', name: state.place.name, urlSlug: state.place.urlSlug, status: 'approved' },
    { id: 'old-rejected', place_id: 'place-old', name: 'Earlier Place', urlSlug: 'earlier-place', status: 'rejected', review_note: 'Please send a business email.' },
  ];
  await page.goto('/my-places?billing=canceled');
  const main = page.getByRole('main', { name: 'My Places', exact: true });
  await expect(main.getByRole('heading', { name: state.place.name, exact: true })).toHaveCount(1);
  await expect(main.getByRole('heading', { name: 'Your Listing Requests', exact: true })).toHaveCount(0);
  await expect(main.getByText('Earlier Place', { exact: true })).not.toBeVisible();
  await expect(main.getByText('Checkout wasn’t completed.', { exact: false })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'View & Edit Place', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Refresh Billing Status', exact: true })).not.toBeVisible();
  await expect(main.getByRole('link', { name: 'Manage Your Place', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('simple-my-places.png'), fullPage: true, animations: 'disabled' });
  await main.locator('summary').filter({ hasText: 'Past requests' }).click();
  await expect(main.getByText('Please send a business email.', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'return to the listing to submit updated details' })).toBeVisible();
  await main.locator('summary').filter({ hasText: 'Membership Details' }).click();
  await expect(main.getByRole('button', { name: 'Refresh Billing Status', exact: true })).toBeVisible();
  await main.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Membership Details' }) }).screenshot({ path: testInfo.outputPath('membership-details.png'), animations: 'disabled' });
});

test('an unpaid owner sees the checkout step first and can dismiss a canceled checkout notice', async ({ page }, testInfo) => {
  await mockSite(page, { unpaid: true });
  await page.goto('/my-places?billing=canceled');
  const main = page.getByRole('main', { name: 'My Places', exact: true });
  await expect(main.getByText('Ready for Bloom', { exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Subscribe to Bloom · $19/month', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Refresh Billing Status', exact: true })).not.toBeVisible();
  await expect(main.getByText('Checkout wasn’t completed.', { exact: false })).toBeVisible();
  await main.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page).toHaveURL(/my-places$/);
  await expect(main.getByText('Checkout wasn’t completed.', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('simple-unpaid-my-places.png'), fullPage: true, animations: 'disabled' });
});

test('editor section navigation keeps publishing in reach and fits a narrow screen', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockSite(page);
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Tagline', { exact: true })).toBeVisible();
  const navigation = dialog.getByRole('navigation', { name: 'Editor sections', exact: true });
  const publish = dialog.getByRole('button', { name: 'Publish Changes', exact: true });
  const initialPosition = await publish.boundingBox();
  await navigation.getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(dialog.getByRole('group', { name: /^Photos/ })).toBeFocused();
  await expect(dialog.getByLabel('Add photos', { exact: true })).toBeAttached();
  const photosPosition = await publish.boundingBox();
  expect(Math.abs(photosPosition.y - initialPosition.y)).toBeLessThan(2);
  await navigation.getByRole('button', { name: 'About', exact: true }).click();
  await dialog.getByLabel('Tagline', { exact: true }).fill('A fresh introduction.');
  await expect(dialog.getByText('Unpublished changes', { exact: true })).toBeVisible();
  await expect(publish).toBeEnabled();
  await dialog.getByRole('button', { name: 'Preview Changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const banner = page.getByRole('region', { name: 'Unpublished preview', exact: true });
  await expect(banner.getByText('Unpublished preview', { exact: true })).toBeFocused();
  await expect(page.getByText('A fresh introduction.', { exact: true })).toBeVisible();
  await banner.getByRole('button', { name: 'Back to Editor', exact: true }).click();
  await expect(dialog.getByLabel('Tagline', { exact: true })).toHaveValue('A fresh introduction.');
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(publish).toBeInViewport();
  expect(await dialog.getByRole('group', { name: /^Photos/ }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await navigation.getByRole('button', { name: 'About', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('editor-narrow.png'), fullPage: true, animations: 'disabled' });
});

test('mixed portrait and landscape photos stay whole, keep a stable stage, and synchronize navigation', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await mockSite(page, { role: 'guest' });
  state.place.photos = Array.from({ length: 10 }, (_, index) => `/gallery-test/photo-${index}.svg`);
  state.place.coverPhoto = state.place.photos[0];
  await page.route('**/gallery-test/*.svg', route => {
    const index = Number(route.request().url().match(/photo-(\d+)/)[1]);
    const [width, height] = index % 3 === 0 ? [600, 900] : index % 3 === 1 ? [1200, 700] : [1600, 500];
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${index % 2 ? '#c6cfa9' : '#78906c'}"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#f9faed" stroke-width="8"/><text x="50%" y="50%" text-anchor="middle" fill="#fff" font-size="48">Photo ${index + 1}</text></svg>` });
  });
  await page.goto('/place/moss-apothecary');
  const carousel = page.getByRole('region', { name: 'Photos of Moss Apothecary', exact: true });
  const stage = carousel.getByLabel('Photo gallery. Use the left and right arrow keys to browse.', { exact: true });
  await expect(carousel.getByRole('button', { name: 'View Photo 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => carousel.locator('img').first().evaluate(image => image.naturalHeight)).toBe(900);
  await expect(stage).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect.poll(() => stage.evaluate(element => element.children[0].offsetLeft)).toBe(0);
  const height = (await stage.boundingBox()).height;
  const first = carousel.getByRole('button', { name: 'Open Photo 1 of 10 in Full View', exact: true });
  await expect.poll(async () => (await first.boundingBox()).width / (await first.boundingBox()).height).toBeCloseTo(600 / 900, 1);
  await carousel.getByRole('button', { name: 'Next Photo', exact: true }).click();
  await expect(carousel.getByRole('button', { name: 'View Photo 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(Math.abs((await stage.boundingBox()).height - height)).toBeLessThan(1);
  await expect.poll(() => stage.evaluate(element => { const slide = element.querySelector('[data-photo-index="1"]'); return Math.abs(Math.min(slide.offsetLeft, element.scrollWidth - element.clientWidth) - element.scrollLeft); })).toBeLessThan(3);
  await expect(carousel.locator('img').nth(1)).toHaveCSS('object-fit', 'contain');
  await carousel.getByRole('button', { name: 'View Photo 10', exact: true }).click();
  await expect(carousel.getByRole('button', { name: 'View Photo 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.getByRole('button', { name: 'View Photo 10', exact: true })).toBeInViewport();
  await stage.press('ArrowLeft');
  await expect(carousel.getByRole('button', { name: 'View Photo 9', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await carousel.getByRole('button', { name: 'View Full Image', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Photo 9 of 10');
  await page.getByRole('button', { name: 'Next Full-Size Photo', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Photo 10 of 10');
  await page.getByRole('button', { name: 'Close Photo Viewer', exact: true }).click();
  await carousel.getByRole('button', { name: 'Open Photo 1 of 10 in Full View', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Photo 1 of 10');
  await page.getByRole('button', { name: 'Close Photo Viewer', exact: true }).click();
  await expect(carousel.getByRole('button', { name: 'View Photo 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await carousel.screenshot({ path: testInfo.outputPath('mixed-gallery.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Bloom blocks an eleventh photo before uploading and shows the ten-photo allowance', async ({ page }) => {
  const state = await mockSite(page);
  state.place.photos = Array.from({ length: 10 }, (_, i) => `/photo-${i}.jpg`);
  state.place.coverPhoto = state.place.photos[0];
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('navigation', { name: 'Editor sections' }).getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(dialog.getByRole('group', { name: /^Photos/ })).toContainText('10 / 10');
  await dialog.getByLabel('Add photos', { exact: true }).setInputFiles({ name: 'extra.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=', 'base64') });
  await expect(dialog.getByRole('alert')).toContainText('Use up to 10 photos');
  await expect(dialog.getByRole('radio')).toHaveCount(10);
});


test('page previews show draft fields privately and preserve editing until discard or publish', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await mockSite(page);
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Place name', { exact: true }).fill('Moss & Fern Studio');
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('A new story waiting to be published.');
  await dialog.getByLabel('Street address', { exact: true }).fill('42 Garden Street');
  await dialog.getByRole('button', { name: 'Preview Changes', exact: true }).click();
  const banner = page.getByRole('region', { name: 'Unpublished preview', exact: true });
  await expect(banner).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Moss & Fern Studio', exact: true })).toBeVisible();
  await expect(page.getByText('A new story waiting to be published.', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary')).toContainText('42 Garden Street');
  expect(state.place.name).toBe('Moss Apothecary');
  expect(state.published).toBeNull();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').last().textContent());
  expect(JSON.stringify(schema)).not.toContain('Moss & Fern Studio');
  await page.screenshot({ path: testInfo.outputPath('page-draft-preview.png'), fullPage: true, animations: 'disabled' });
  await banner.getByRole('button', { name: 'Back to Editor', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(dialog.getByLabel('Place name', { exact: true })).toHaveValue('Moss & Fern Studio');
  await dialog.getByRole('button', { name: 'Preview Changes', exact: true }).click();
  page.once('dialog', confirmation => confirmation.accept());
  await banner.getByRole('button', { name: 'Discard Changes', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Moss Apothecary', exact: true })).toBeVisible();
  await expect(page.getByText('A new story waiting to be published.', { exact: true })).toHaveCount(0);
  expect(state.published).toBeNull();
});

test('a conflict while publishing page preview retains the draft for recovery', async ({ page }) => {
  const state = await mockSite(page, { conflict: true });
  await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Edit Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tagline', { exact: true }).fill('Keep this draft.');
  await dialog.getByRole('button', { name: 'Preview Changes', exact: true }).click();
  const banner = page.getByRole('region', { name: 'Unpublished preview', exact: true });
  await banner.getByRole('button', { name: 'Publish Changes', exact: true }).click();
  await expect(banner.getByRole('alert')).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Publish Changes', exact: true })).toBeDisabled();
  await banner.getByRole('button', { name: 'Back to Editor', exact: true }).click();
  await expect(dialog.getByLabel('Tagline', { exact: true })).toHaveValue('Keep this draft.');
  await expect(dialog.getByRole('button', { name: 'Reload Latest Version', exact: true })).toBeVisible();
  expect(state.published).toBeNull();
});

test('account dropdown identifies the user and supports dismissal and sign out', async ({ page, isMobile }, testInfo) => {
  const displayName = isMobile ? '' : 'Jamie Green';
  const state = await mockSite(page, { displayName });
  await page.goto('/favorites');
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Explore Places', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Liked Places', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Our Story', exact: true })).toHaveCount(0);
  const account = navigation.getByRole('button', { name: displayName || 'owner', exact: true });
  await expect(account).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'My Places', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'For Business Owners', exact: true })).toHaveCount(0);
  await account.click();
  await expect(navigation.getByRole('link', { name: 'My Places', exact: true })).toBeVisible();
  await expect(navigation.getByText('owner@example.com', { exact: true })).toBeVisible();
  await expect(account).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: testInfo.outputPath('account-menu.png'), animations: 'disabled' });
  await account.press('Escape');
  await expect(account).toBeFocused();
  await expect(navigation.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(0);
  await account.click();
  await page.mouse.click(5, 5);
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await account.click();
  await navigation.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(account).toHaveCount(0);
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(navigation.getByRole('link', { name: 'Join the Community' })).toBeVisible();
  expect(state.authRequests.some(request => request.url.includes('/logout'))).toBe(true);
});


for (const role of ['member', 'owner', 'admin']) test(`account settings work for ${role} accounts`, async ({ page, isMobile }, testInfo) => {
  const state = await mockSite(page, { role });
  await page.goto('/favorites');
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Liked Places', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Our Story', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'For Business Owners', exact: true })).toHaveCount(role === 'member' ? 1 : 0);
  await navigation.getByRole('button', { name: role, exact: true }).click();
  await expect(navigation.getByRole('link', { name: 'My Places', exact: true })).toHaveCount(role === 'member' ? 0 : 1);
  await navigation.getByRole('link', { name: 'Account Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { name: 'Your Account.', exact: true })).toBeVisible();
  await page.getByLabel('Your name', { exact: true }).fill('Jamie Green');
  await page.getByRole('button', { name: 'Save Name', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your name has been saved.');
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(navigation.getByRole('button', { name: 'Jamie Green', exact: true })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByLabel('New email address', { exact: true }).fill('new@example.com');
  await page.getByRole('button', { name: 'Update Email', exact: true }).click();
  await expect(page.getByText('Awaiting confirmation:', { exact: false })).toContainText('new@example.com');
  await expect(page.getByText('Your current sign-in email is', { exact: false })).toContainText(`${role}@example.com`);
  const emailRequest = state.authRequests.find(request => request.body?.email === 'new@example.com');
  expect(emailRequest.url).toContain(encodeURIComponent('/auth/callback?next=%2Fsettings'));
  await page.getByRole('radio', { name: 'Map See where places are located.', exact: true }).check();
  await page.getByRole('button', { name: 'Save Preferences', exact: true }).click();
  await expect(page.getByText('Your browsing preference has been saved.', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('account-settings.png'), fullPage: true, animations: 'disabled' });
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await navigation.getByRole('link', { name: 'Explore Places', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('settings require sign in and preserve their return destination', async ({ page }) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  await expect(page.getByRole('heading', { name: 'Welcome Back', exact: true })).toBeVisible();
});

test('failed account updates keep entered details and allow retry', async ({ page }) => {
  const state = await mockSite(page, { role: 'member' });
  await page.goto('/settings');
  state.authUpdateError = 'Unable to update this account.';
  await page.getByLabel('Your name', { exact: true }).fill('Jamie Green');
  await page.getByRole('button', { name: 'Save Name', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to update this account.');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Jamie Green');
  state.authUpdateError = null;
  await page.getByRole('button', { name: 'Save Name', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Your name has been saved.');
});

test('admin sections and searches survive reload and browser Back', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'admin' });
  await page.goto('/admin?section=users&q=owner&page=2');
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveValue('owner');
  await expect.poll(() => state.directoryRequests.at(-1)?.p_page).toBe(1);
  await page.getByRole('button', { name: 'Clear Search', exact: true }).click();
  await expect.poll(() => state.directoryRequests.at(-1)?.p_query).toBe('');
  await expect.poll(() => state.directoryRequests.at(-1)?.p_page).toBe(0);
  await page.getByRole('button', { name: 'Listing Requests', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No listing requests to review', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('Fern');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching results', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('Fern');
  await expect(page.getByRole('heading', { name: 'Listing Requests', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Users', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('admin-workspace.png'), fullPage: true, animations: 'disabled' });
});

test('admin failures offer recovery without showing an empty queue as success', async ({ page }) => {
  const state = await mockSite(page, { role: 'admin' }); state.directoryError = 'Directory unavailable';
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('Directory unavailable');
  await expect(page.getByRole('heading', { name: 'No claims to review', exact: true })).toHaveCount(0);
  state.directoryError = '';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manage Place', exact: true })).toBeVisible();
  state.detailError = 'Place lookup unavailable';
  await page.getByRole('button', { name: 'Manage Place', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Place lookup unavailable');
  await expect(dialog.getByText('Loading place details…', { exact: true })).toHaveCount(0);
  state.detailError = '';
  await dialog.getByRole('button', { name: 'Retry Loading Place', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Managers', exact: true })).toBeVisible();
});


test('admin badges show global pending counts, hide zeroes, and refresh after a decision', async ({ page }, testInfo) => {
  const state = await mockSite(page, { role: 'admin' });
  state.attentionCounts = { claims: 12, 'listing-requests': 4, locations: 1 };
  await page.goto('/admin');
  const sections = page.getByRole('group', { name: 'Admin sections' });
  await expect(sections.getByRole('button', { name: 'Claim Requests', exact: true })).toContainText('12');
  await expect(sections.getByRole('button', { name: 'Listing Requests', exact: true })).toContainText('4');
  await expect(sections.getByRole('button', { name: 'Location Review', exact: true })).toContainText('1');
  await expect(sections.getByRole('button', { name: 'Users', exact: true })).toHaveText('Users');
  await page.screenshot({ path: testInfo.outputPath('admin-pending-badges.png'), fullPage: true, animations: 'disabled' });
  state.attentionCounts.claims = 0;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Approve Claim', exact: true }).click();
  await expect(sections.getByRole('button', { name: 'Claim Requests', exact: true }).locator('span[aria-hidden="true"]')).toHaveCount(0);
  state.attentionError = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Review counts couldn’t refresh.')).toBeVisible();
  await expect(sections.getByRole('button', { name: 'Listing Requests', exact: true })).toContainText('4');
});

test('admin email review links preserve their section through sign-in', async ({ page }) => {
  await mockSite(page, { role: 'guest' });
  await page.goto('/admin?section=listing-requests');
  await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toHaveAttribute('href', '/login?next=%2Fadmin%3Fsection%3Dlisting-requests');
});
