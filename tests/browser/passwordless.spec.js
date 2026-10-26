import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function setup(page) {
  const state = { auth: [], requests: [], attempts: [], failListing: false, claims: [] };
  const user = { id: 'otp-user', email: 'owner@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', aud: 'authenticated', app_metadata: {}, user_metadata: {} };
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url')}.test`;
  const session = { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user };
  await page.route('**/auth/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.auth.push({ path, body });
    if (path.endsWith('/otp') && state.sendError) return route.fulfill({ status: 429, json: { msg: 'Please wait before requesting another code.' } });
    if (path.endsWith('/otp')) return route.fulfill({ json: {} });
    if (path.endsWith('/verify') && state.verifyGate) await state.verifyGate;
    if (path.endsWith('/verify') && state.verifyUnavailable) return route.fulfill({ status: 503, json: { msg: 'Temporarily unavailable' } });
    if (path.endsWith('/verify') && body.token !== '123456') return route.fulfill({ status: 403, json: { msg: 'Token expired', error_code: 'otp_expired' } });
    return route.fulfill({ json: path.endsWith('/verify') ? session : user });
  });
  await page.route('**/rest/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/get_management_context')) return route.fulfill({ json: { is_admin: false, memberships: [], claims: state.claims } });
    if (path.endsWith('/get_listing_requests')) return route.fulfill({ json: state.requests });
    if (path.endsWith('/request_place_listing')) {
      const body = route.request().postDataJSON(); state.attempts.push(body);
      if (state.failListing) return route.fulfill({ status: 503, json: { message: 'Please try sending again.' } });
      state.requests.push({ id: body.p_request_id, name: body.p_name, city: body.p_city, status: 'pending', created_at: new Date().toISOString() });
      return route.fulfill({ json: body.p_request_id });
    }
    if (path.endsWith('/request_place_claim')) { state.claims.push({ id: 'claim-1', place_id: 'place-1', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', status: 'pending' }); return route.fulfill({ json: null }); }
    const place = { id: 'place-1', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', tagline: 'Rooted in plants.', description: 'Herbal teas and workshops.', website: 'https://example.com/', address: '123 Main Street', city: 'Boulder', state: 'CO', zip: '80301', coverPhoto: '/assets/pages/home/hero.jpg', photos: [], latitude: 40, longitude: -105, isFeatured: false, isVerified: true, is_claimed: false, category_ids: ['shops'], social_links: [] };
    return route.fulfill({ json: path.includes('/rpc/') ? null : path.endsWith('/favorites') || path.endsWith('/profiles') ? [] : [place] });
  });
  return state;
}
async function sendCode(page, registering = false) {
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  if (registering) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  await expect(page.getByLabel('Email code', { exact: true })).toBeFocused();
}

test('existing account verifies a code and returns to a safe destination', async ({ page }, testInfo) => {
  const state = await setup(page); await page.goto('/login?next=%2Fsettings');
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `/private/tmp/herbplaces-passwordless-${testInfo.project.name}-email.png`, fullPage: true });
  await sendCode(page);
  await page.screenshot({ path: `/private/tmp/herbplaces-passwordless-${testInfo.project.name}-code.png`, fullPage: true });
  expect(state.auth.find(item => item.path.endsWith('/otp')).body.create_user).toBe(false);
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.getByLabel('Email code', { exact: true }).fill('000000');
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
  await expect(page.getByLabel('Email code', { exact: true })).toBeFocused();
  await page.getByLabel('Email code', { exact: true }).fill('123 456');
  await expect.poll(() => state.auth.filter(item => item.path.endsWith('/verify')).at(-1)?.body.token).toBe('123456');
  await expect(page).toHaveURL('/settings');
  await expect(page.getByText('Sign in with a code sent to your email.')).toBeVisible();
});

test('registration requires consent and supports changing email and resending', async ({ page }) => {
  const state = await setup(page); await page.goto('/register?next=https%3A%2F%2Fevil.example');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  expect(state.auth.filter(item => item.path.endsWith('/otp'))).toHaveLength(0);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  expect(state.auth.find(item => item.path.endsWith('/otp')).body.create_user).toBe(true);
  expect(state.auth.find(item => item.path.endsWith('/otp')).body).not.toHaveProperty('password');
  await page.getByRole('button', { name: 'Change Email', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('owner@example.com');
  await page.getByLabel('Email', { exact: true }).fill('other@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('other@example.com');
  await page.clock.install();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Send a New Code', exact: true }).click();
  expect(state.auth.filter(item => item.path.endsWith('/otp'))).toHaveLength(3);
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await expect(page).toHaveURL('/map');
});

test('listing verification sends the saved request once without storing sign-in details', async ({ page }) => {
  const state = await setup(page); await page.goto('/the-little-garden/start?plan=bloom&new=1');
  await page.getByLabel('Place name', { exact: true }).fill('Fern Corner');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await sendCode(page, true);
  expect(state.attempts).toHaveLength(0);
  const saved = await page.evaluate(() => [sessionStorage.getItem('little-herb-listing-request'), localStorage.getItem('little-herb-listing-request-confirmation')]);
  for (const draft of saved) { expect(draft).toContain('Fern Corner'); expect(draft).not.toContain('owner@example.com'); expect(draft).not.toContain('123456'); }
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify & Send Request' }).click();
  await expect(page.getByRole('heading', { name: 'Thanks — we’ve got it.' })).toBeVisible();
  expect(state.attempts).toHaveLength(1); expect(state.requests[0].name).toBe('Fern Corner');
  expect(await page.evaluate(() => localStorage.getItem('little-herb-listing-request-confirmation'))).toBeNull();
});

test('failed listing submission retains verified account and the same request for retry', async ({ page }) => {
  const state = await setup(page); state.failListing = true; await page.goto('/request-place');
  await page.getByLabel('Place name', { exact: true }).fill('Fern Corner');
  await page.getByLabel('City', { exact: true }).fill('Boulder');
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await sendCode(page, true);
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify & Send Request' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try sending again.');
  state.failListing = false;
  await page.getByRole('button', { name: 'Send Listing Request', exact: true }).click();
  await expect(page.getByText('Your listing request is saved.', { exact: false })).toBeVisible();
  expect(state.attempts).toHaveLength(2); expect(state.attempts[0].p_request_id).toBe(state.attempts[1].p_request_id);
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(1);
});


test('send failures preserve the email and allow retry', async ({ page }) => {
  const state = await setup(page); state.sendError = true; await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Please wait');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('owner@example.com');
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(0);
  state.sendError = false;
  await page.getByRole('button', { name: 'Send Email Code', exact: true }).click();
  await expect(page.getByLabel('Email code', { exact: true })).toBeFocused();
});

test('ownership details survive email-code sign-in and still require explicit claim review', async ({ page }) => {
  const state = await setup(page); await page.goto('/place/moss-apothecary');
  await page.getByRole('button', { name: 'Claim This Place', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your full name').fill('Jamie Green');
  await dialog.getByRole('combobox', { name: 'Your role', exact: true }).selectOption('Owner');
  await dialog.getByLabel('Business email', { exact: true }).fill('owner@example.com');
  await dialog.getByRole('textbox', { name: 'Ownership details', exact: true }).fill('I founded this place and our website lists me as its owner.');
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Sign In to Send Claim' }).click();
  await sendCode(page);
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await expect(page).toHaveURL(/moss-apothecary\?claim=1/);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Your full name')).toHaveValue('Jamie Green');
  expect(state.claims).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Review Claim' }).click();
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Submit Claim' }).click();
  await expect(page.getByRole('link', { name: 'Claim Pending' })).toBeVisible();
  expect(state.claims).toHaveLength(1);
});


for (const path of ['forgot-password', 'reset-password', 'resend-confirmation']) {
  test(`old ${path} links lead to code sign-in without creating a password`, async ({ page }) => {
    await setup(page); await page.goto(`/auth/${path}?next=%2Fmy-places`);
    await expect(page).toHaveURL('/login?next=%2Fmy-places');
    await expect(page.getByRole('button', { name: 'Send Email Code', exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
}


test('native AutoFill events verify a full code once and ignore incomplete input', async ({ page }) => {
  const state = await setup(page);
  let release; state.verifyGate = new Promise(resolve => { release = resolve; });
  await page.goto('/login?next=%2Fsettings'); await sendCode(page);
  const input = page.getByLabel('Email code', { exact: true });
  await expect(input).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByRole('link', { name: 'Create an Account', exact: true })).toHaveCount(0);
  await input.fill('12345');
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(0);
  await input.evaluate(element => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '123456');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: '123456' }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(input).toBeDisabled();
  await expect(page.getByText('Signing you in…', { exact: true })).toBeVisible();
  await expect.poll(() => state.auth.filter(item => item.path.endsWith('/verify')).length).toBe(1);
  release(); await expect(page).toHaveURL('/settings');
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(1);
});

test('a failed automatic verification offers an explicit retry without looping', async ({ page }) => {
  const state = await setup(page); state.verifyUnavailable = true;
  await page.goto('/login?next=%2Fsettings'); await sendCode(page);
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await expect(page.getByRole('alert')).toContainText('We couldn’t check your code');
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(1);
  state.verifyUnavailable = false;
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page).toHaveURL('/settings');
  expect(state.auth.filter(item => item.path.endsWith('/verify'))).toHaveLength(2);
});
