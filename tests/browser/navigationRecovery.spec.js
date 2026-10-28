import { test, expect } from '@playwright/test';

test('a failed page download recovers once and preserves the destination', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  let failed = false;
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/src/pages/TheLittleGarden/BusinessPlan.jsx', route => {
    if (!failed) { failed = true; return route.abort('failed'); }
    return route.continue();
  });
  await page.goto('/the-little-garden');
  await page.getByRole('link', { name: 'Explore Bloom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Help the right people choose your place.', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/the-little-garden\/bloom\/?$/);
  expect(failed).toBe(true);
  expect(documents).toBe(2);
});

test('persistent download failures show a retry screen and can recover without looping', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  let blocked = true;
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/src/pages/TheLittleGarden/BusinessPlan.jsx', route => blocked ? route.abort('failed') : route.continue());
  await page.goto('/the-little-garden');
  await page.getByRole('link', { name: 'Explore Bloom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let’s try that page again.', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try Again', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(documents).toBe(2);
  blocked = false;
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Help the right people choose your place.', exact: true })).toBeVisible();
  expect(documents).toBe(3);
});

test('a page rendering error leaves navigation available and does not automatically reload', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/src/pages/TheLittleGarden/BusinessPlan.jsx', route => route.fulfill({ contentType: 'application/javascript', body: 'export default function BusinessPlan() { throw new Error("Test page rendering failure"); }' }));
  await page.goto('/the-little-garden');
  await page.getByRole('link', { name: 'Explore Bloom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let’s try that page again.', exact: true })).toBeVisible();
  expect(documents).toBe(1);
  await page.locator('#main-content').getByRole('link', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('try that page again');
  expect(documents).toBe(2);
});
