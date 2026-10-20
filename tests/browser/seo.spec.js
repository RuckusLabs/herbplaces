import { test, expect } from '@playwright/test';

const place = { id: 'seo-place', name: 'Moss & Fern', urlSlug: 'moss-and-fern', city: 'Denver', state: 'CO', address: '123 Main St', description: 'Herbal teas and workshops.', tagline: 'A little care, rooted in plants.', coverPhoto: '/assets/pages/home/hero.jpg', photos: ['/assets/pages/home/hero.jpg'], category_ids: ['shops'], latitude: 39.7, longitude: -104.9, is_claimed: true };

test('place metadata is unique and updates during client navigation', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [place] }));
  await page.goto('/place/moss-and-fern/');
  await expect(page.getByRole('heading', { name: 'Moss & Fern', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to favorites', exact: true }).first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://littleherbplaces.com/place/moss-and-fern/');
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Moss & Fern in Denver, CO | Little Herb Places');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /https:\/\/littleherbplaces.com\/og\/places\/moss-and-fern-[a-f0-9]+.jpg/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(data['@graph'][0]['@type']).toBe('LocalBusiness');
  await page.getByRole('link', { name: 'All Places', exact: true }).click();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Explore Places | Little Herb Places');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://littleherbplaces.com/map/');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await page.goto('/favorites/');
  await expect(page.getByRole('heading', { name: 'Your Saved Places.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
