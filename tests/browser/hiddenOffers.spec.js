import { test, expect } from '@playwright/test';
import { mockFreeMaps } from './fixtures/freeMaps';

const place = { id: 'hidden-offer-place', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', city: 'Denver', state: 'CO', latitude: 39.7, longitude: -104.9, description: 'Herbal teas.', coverPhoto: '/assets/pages/home/hero.jpg', photos: [], category_ids: ['shops'] };
const hiddenLinks = 'a[href*="/register"], a[href*="/signup"], a[href*="/the-little-garden/sprout"], a[href*="/the-little-garden/thrive"]';

test.beforeEach(async ({ page }) => {
  await mockFreeMaps(page);
  await page.route('**/rest/v1/**', route => route.fulfill({ json: route.request().url().includes('/public_places') ? [place] : [] }));
  await page.route('**/functions/v1/**', route => route.fulfill({ status: 204 }));
});

test('public pages hide signup and Thrive links while keeping existing-account sign in', async ({ page }, testInfo) => {
  for (const path of ['/', '/the-little-garden', '/the-little-garden/bloom', '/favorites', '/login', '/help', '/discover', '/the-little-garden/sprout', '/the-little-garden/start?plan=thrive']) {
    await page.goto(path);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.locator(hiddenLinks)).toHaveCount(0);
  }
  await page.goto('/the-little-garden');
  await expect(page.getByRole('heading', { name: 'Bloom', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Listing', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Thrive');
  if (page.viewportSize().width < 760) await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Sign In', exact: true })).toHaveAttribute('href', '/login');
  await page.screenshot({ path: testInfo.outputPath('bloom-and-free-listing.png'), fullPage: true, animations: 'disabled' });
});

test('guest saving keeps the save and offers sign in without a signup link', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('button', { name: 'Save to favorites', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(hiddenLinks)).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Already a Member? Sign In' })).toHaveAttribute('href', '/login?next=%2Ffavorites');
  await dialog.getByRole('button', { name: 'Keep Browsing' }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites', exact: true }).first()).toBeVisible();
});
