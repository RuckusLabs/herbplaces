import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function site(page, { admin = false, dnt = false } = {}) {
  const state = { events: [], applications: [], fail: false, overviewCalls: 0, reviews: [] };
  if (dnt) await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
  if (admin) {
    const user = { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', email_confirmed_at: '2026-01-01', aud: 'authenticated', app_metadata: {}, user_metadata: {} };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url')}.test`;
    const session = { access_token: token, refresh_token: 'test', token_type: 'bearer', expires_at: exp, expires_in: 3600, user };
    await page.addInitScript(value => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)), session);
    await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/token') ? session : user }));
  }
  await page.route('**/functions/v1/business-journey', route => {
    const body = route.request().postDataJSON();
    if (body.action === 'event') { state.events.push(body); return route.fulfill({ json: { accepted: true } }); }
    state.applications.push(body);
    return route.fulfill({ status: state.fail ? 503 : 200, json: state.fail ? { error: 'Your application could not be saved. Please try again.' } : { accepted: true } });
  });
  await page.route('**/rest/v1/**', route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'get_management_context') return route.fulfill({ json: { is_admin: admin, memberships: [], claims: [] } });
    if (name === 'admin_business_overview') { state.overviewCalls++; return route.fulfill({ json: { from: '2026-09-29T00:00:00Z', through: '2026-10-29T00:00:00Z', interest: [], milestones: [{ kind: 'subscription_active', places: 2 }], applications: [{ id: '00000000-0000-0000-0000-000000000010', business: 'Moss Apothecary', email: 'owner@example.com', website: 'https://example.com', goal: 'Help people discover our seasonal workshops.', status: 'pending', created_at: '2026-10-28T00:00:00Z', review_note: '' }] } }); }
    return route.fulfill({ json: name === 'public_places' || name === 'public_place_growth' || name === 'get_listing_requests' ? [] : null });
  });
  return state;
}

test('business pricing separates the free listing and community membership and labels report examples', async ({ page }) => {
  await site(page); await page.goto('/the-little-garden');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Give Your BusinessRoom to Bloom.');
  const plans = page.getByRole('region', { name: 'Choose What Helps Your Place Grow.' });
  await expect(plans.getByRole('heading', { name: 'Business Listing', exact: true })).toBeVisible();
  await expect(plans.getByRole('heading', { name: 'Sprout', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore Sprout', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Explore Bloom', exact: true }).click();
  const report = page.getByRole('figure', { name: 'Illustrative Bloom activity report' });
  await expect(report).toContainText('Illustrative report · sample numbers');
  await expect(report).toContainText('Fictional business and example activity');
  await expect(report).toContainText('September 1–30, 2026');
});

test('retired Thrive links do not expose applications or submit requests', async ({ page }) => {
  const state = await site(page);
  await page.goto('/the-little-garden/thrive');
  await expect(page).toHaveURL(/the-little-garden\/?$/);
  await expect(page.getByRole('heading', { name: 'Bloom', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Pilot Application' })).toHaveCount(0);
  expect(state.applications).toEqual([]);
});

test('business interest is deduplicated and contains only allowlisted labels', async ({ page }) => {
  const state = await site(page); await page.goto('/the-little-garden/bloom');
  await expect.poll(() => state.events.filter(row => row.kind === 'plan_view').length).toBe(1);
  await page.getByRole('complementary', { name: 'Bloom plan details' }).getByRole('link', { name: 'Get Started with Bloom', exact: true }).click();
  await expect.poll(() => state.events.filter(row => row.kind === 'plan_cta').length).toBe(1);
  await page.getByRole('link', { name: '← Back to Bloom', exact: true }).click();
  expect(state.events.filter(row => row.kind === 'plan_view')).toHaveLength(1);
  expect(state.events.every(row => Object.keys(row).every(key => ['action','event_id','session_id','kind','plan','entry','device'].includes(key)))).toBe(true);
  expect(JSON.stringify(state.events)).not.toContain('@');
});

test('Do Not Track suppresses optional business interest', async ({ page }) => {
  const state = await site(page, { dnt: true }); await page.goto('/the-little-garden/bloom');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('complementary', { name: 'Bloom plan details' }).getByRole('link', { name: 'Get Started with Bloom', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Business setup progress' })).toBeVisible();
  expect(state.events).toEqual([]);
});

test('empty Discover offers useful paths without searching empty inventory and stays noindex', async ({ page }) => {
  await site(page); await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'More Little Discoveries Are Growing.' })).toBeVisible();
  await expect(page.getByRole('search')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('link', { name: 'Browse Places', exact: true })).toHaveAttribute('href', '/browse');
  await expect(page.locator('a[href*="/thrive"]')).toHaveCount(0);
});

test('business growth admin blocks signed-out access and provides private reporting', async ({ page }) => {
  const guest = await site(page); await page.goto('/admin/business-growth');
  await expect(page.getByText('Administrator access is required.', { exact: false })).toBeVisible();
  expect(guest.overviewCalls).toBe(0);
  await page.unrouteAll({ behavior: 'wait' });
  const admin = await site(page, { admin: true }); await page.reload();
  await expect(page.getByRole('heading', { name: 'Listing Details to Check', exact: true })).toBeVisible();
  await expect(page.getByText('Thrive Pilot Applications', { exact: true })).toHaveCount(0);
  await expect.poll(() => admin.overviewCalls).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Recorded business stages · last 30 days' })).toBeVisible();
});
