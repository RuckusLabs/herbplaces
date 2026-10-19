import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

const image = '/assets/pages/home/hero.jpg';
const makePlace = () => ({ id: 'place-1', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', tagline: 'A little care, rooted in plants.',
  description: 'Herbal teas and community workshops.', website: 'https://example.com/', address: '123 Main Street', city: 'Denver', state: 'CO', zip: '80201',
  coverPhoto: image, photos: [image], latitude: 39.7, longitude: -104.9, isFeatured: false, isVerified: true,
  is_claimed: false, phone: '', hours: '', social_links: [], category_ids: ['shops'], photo_alt: {}, content_version: 1, geocode_status: 'confirmed' });

async function mockSite(page, { role = 'owner', expired = false, conflict = false, confirmed = true } = {}) {
  const state = { place: makePlace(), claims: [], assigned: [], published: null, directoryRequests: [], removed: null, users: [
    { user_id: 'user-1', email: 'admin@example.com', is_admin: true, confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [] },
    { user_id: 'manager-1', email: 'owner@example.com', confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [{ id: 'place-1', name: 'Moss Apothecary', is_billing_contact: false, pending: false }] },
    { user_id: 'billing-1', email: 'billing@example.com', billing_protected: true, confirmed_at: '2026-01-01', created_at: '2026-01-01', places: [{ id: 'place-1', name: 'Moss Apothecary', is_billing_contact: true, pending: false }] },
  ] };
  const user = { id: 'user-1', email: `${role}@example.com`, email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null, aud: 'authenticated', app_metadata: {}, user_metadata: {} };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, role: 'authenticated' })).toString('base64url')}.local-test-signature`;
  const session = { access_token: token, refresh_token: 'local-test-refresh', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600, user };
  if (role !== 'guest') await page.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const subscription = { status: expired ? 'canceled' : 'active', paid_until: new Date(Date.now() + 86400000).toISOString(), grace_ends_at: null, cancel_at_period_end: false };
  const context = () => ({ is_admin: role === 'admin', memberships: role === 'owner' ? [{ place_id: state.place.id, is_billing_contact: true, can_edit: !expired, place: state.place, subscription }] : [], claims: state.claims });
  await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/token') ? session : user }));
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.includes('/rpc/')) return route.fulfill({ json: path.endsWith('/favorites') ? [] : [state.place] });
    const name = path.split('/').at(-1);
    const body = request.postDataJSON() || {};
    if (name === 'activate_place_invitations') return route.fulfill({ json: null });
    if (name === 'get_management_context') return route.fulfill({ json: context() });
    if (name === 'admin_create_place') {
      state.creationAttempts ||= []; state.creationAttempts.push(body);
      if (state.creationError) return route.fulfill({ status: 400, json: { message: state.creationError } });
      state.created = body;
      state.place = { ...makePlace(), ...body.p_content, id: 'place-new', urlSlug: body.p_slug, isVerified: false, latitude: null, longitude: null, geocode_status: 'review' };
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
    if (name === 'admin_directory') { state.directoryRequests.push(body); return route.fulfill({ json: body.p_section === 'claims'
      ? { total: 1, items: [{ id: 'claim-1', place_id: state.place.id, name: state.place.name, urlSlug: state.place.urlSlug, email: 'claimant@example.com', relationship: 'Owner', evidence: 'Please verify our business website.', created_at: new Date().toISOString() }] }
      : body.p_section === 'users' ? { total: state.users.length, items: state.users }
        : { total: 1, items: [{ ...state.place, subscription_status: 'active' }] } }); }
    if (name === 'admin_place_detail') return route.fulfill({ json: { place: state.place, subscription,
      members: [{ user_id: user.id, email: 'owner@example.com', is_billing_contact: true }, ...state.assigned], invitations: [], revisions: [], audit: [] } });
    if (name === 'admin_assign_manager') { state.assigned.push({ user_id: body.p_email, email: body.p_email, is_billing_contact: body.p_billing }); return route.fulfill({ json: null }); }
    if (name === 'admin_review_claim') { state.reviewed = body; return route.fulfill({ json: null }); }
    return route.fulfill({ json: null });
  });
  await page.route('**/functions/v1/place-management', async route => {
    if (route.request().headers()['content-type']?.startsWith('multipart/form-data')) return route.fulfill({ json: { url: '/assets/pages/the-little-garden/garden.webp' } });
    const body = route.request().postDataJSON();
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
  await expect(dialog.getByRole('region', { name: 'Place preview' })).toContainText('Newly gathered, just for you.');
  await page.screenshot({ path: testInfo.outputPath('place-editor.png'), fullPage: true, animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Publish Changes' }).click();
  await expect(dialog).not.toBeVisible(); await expect(page.getByText('Your changes are live.', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Editing paused', { exact: true })).toBeVisible();
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
