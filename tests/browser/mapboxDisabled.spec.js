import { test, expect } from '@playwright/test';

test('home and legacy map links make no Mapbox requests', async ({ page }) => {
  const requests = [];
  await page.route(/https:\/\/([^/]+\.)?mapbox\.(com|cn)\//, route => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.route('**/rest/v1/public_places*', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Explore Places', exact: true })).toBeVisible();
  await expect(page.locator('img[src="/assets/pages/home/hero.jpg"]')).toBeVisible();
  await page.goto('/map?view=map');
  await expect(page.getByRole('heading', { name: 'Somewhere Good Is Growing.' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Directory view' })).toHaveCount(0);
  await expect(page.locator('.mapboxgl-map')).toHaveCount(0);
  expect(requests).toEqual([]);
});
