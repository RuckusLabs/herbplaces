import { test, expect } from '@playwright/test';
import { emptyMapStyle, mockFreeMaps } from './fixtures/freeMaps';

const forbiddenRequests = new WeakMap();

test.afterEach(async ({ page }) => { expect(forbiddenRequests.get(page)).toEqual([]); });

const place = { id: 'free-map-place', name: 'Moss Apothecary', urlSlug: 'moss-apothecary', city: 'Denver', state: 'CO', description: 'Herbal teas and workshops.', coverPhoto: '/assets/pages/home/hero.jpg', photos: ['/assets/pages/home/hero.jpg'], category_ids: ['shops'], latitude: 39.7, longitude: -104.9, isVerified: true, geocode_status: 'confirmed' };

test.beforeEach(async ({ page }) => {
  await mockFreeMaps(page);
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [place, { ...place, id: 'unlocated', name: 'Unlocated Herb Shop', urlSlug: 'unlocated-herb-shop', latitude: null, longitude: null }] }));
  await page.route('https://scripts.simpleanalyticscdn.com/**', route => route.abort());
  const forbidden = [];
  forbiddenRequests.set(page, forbidden);
  page.on('request', request => {
    const url = new URL(request.url());
    if (/(^|\.)mapbox\.(com|cn)$/.test(url.hostname) || /\/geocod(e|ing)(\/|\?)/.test(url.pathname)) forbidden.push(request.url());
  });

});

test('homepage map keeps clickable pins and attribution after resizing', async ({ page }, testInfo) => {
  await page.goto('/');
  const pins = page.getByRole('group', { name: 'Explore little places' });
  await expect(pins.getByRole('button', { name: 'Visit Moss Apothecary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'OpenFreeMap', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'OpenMapTiles', exact: true })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => pins.evaluate(element => {
      const container = element.getBoundingClientRect();
      const pin = element.querySelector('button').getBoundingClientRect();
      return pin.left >= container.left && pin.right <= container.right && pin.top >= container.top && pin.bottom <= container.bottom;
    })).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('free-map-home.png'), fullPage: true, animations: 'disabled' });
  await pins.getByRole('button', { name: 'Visit Moss Apothecary' }).click();
  await expect(page).toHaveURL(/\/place\/moss-apothecary/);
});

test('directory renders the free map with attribution and selection', async ({ page, isMobile }) => {
  await page.goto('/map?view=map');
  await expect(page.getByRole('button', { name: 'Search This Area', exact: true })).toBeEnabled();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  const attribution = page.locator('.maplibregl-ctrl-attrib');
  await expect(attribution).toContainText('OpenFreeMap');
  await expect(attribution).toContainText('OpenMapTiles');
  await expect(attribution).toContainText('OpenStreetMap');
  await page.getByRole('button', { name: 'View Moss Apothecary on Map', exact: true }).click();
  if (isMobile) await expect(page.getByRole('region', { name: 'Selected place: Moss Apothecary' })).toBeVisible();
  else await expect(page.locator('#discover-place-preview')).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unlocated Herb Shop', exact: true })).toBeVisible();
});

test('unavailable maps show the photo and full directory, and explicit retry works', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Explore the Directory', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Explore little places' })).toHaveCount(0);
  await expect(page.locator('img[src="/assets/pages/home/hero.jpg"]').first()).toBeVisible();
  await page.goto('/map?view=map&q=Herb');
  await expect(page.getByRole('heading', { name: 'A Little Trouble Finding Our Way.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlocated Herb Shop', exact: true })).toBeVisible();
  await mockFreeMaps(page);
  await page.getByRole('button', { name: 'Try the Map Again' }).click();
  await expect(page.getByRole('button', { name: 'Search This Area', exact: true })).toBeEnabled();
});

test('map initialization times out after fifteen seconds without hiding places', async ({ page }) => {
  await page.clock.install();
  await page.route('https://tiles.openfreemap.org/**', () => {});
  await page.goto('/map?view=map');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.clock.fastForward(15001);
  await expect(page.getByRole('heading', { name: 'A Little Trouble Finding Our Way.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlocated Herb Shop', exact: true })).toBeVisible();
});

test('unsupported WebGL leaves the homepage and directory usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Explore the Directory', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Explore little places' })).toHaveCount(0);
  await page.goto('/map?view=map');
  await expect(page.getByRole('button', { name: 'Try the Map Again' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlocated Herb Shop', exact: true })).toBeVisible();
});

test('a style cannot redirect map resources to a metered provider', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', route => route.fulfill({ json: {
    ...emptyMapStyle,
    sprite: 'https://api.mapbox.com/styles/v1/unexpected/sprite',
  } }));
  await page.goto('/map?view=map');
  await expect(page.getByRole('heading', { name: 'A Little Trouble Finding Our Way.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlocated Herb Shop', exact: true })).toBeVisible();
});

test('homepage preserves the production overview while allowing panning and reset', async ({ page, isMobile }) => {
  await page.goto('/');
  const map = page.getByRole('region', { name: 'Explore Little Herb Places on the Map', exact: true });
  const pin = map.getByRole('button', { name: 'Visit Moss Apothecary', exact: true });
  await expect(pin).toBeVisible();
  await expect(map.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  const start = await pin.boundingBox();
  const bounds = await map.boundingBox();
  // Keyboard arrows offer the same panning on touch devices without interfering with page scrolling.
  await map.locator('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Reset Map', exact: true })).toBeVisible();
  await expect.poll(async () => Math.abs((await pin.boundingBox()).x - start.x)).toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Reset Map', exact: true }).click();
  await expect.poll(async () => Math.abs((await pin.boundingBox()).x - start.x)).toBeLessThan(1);
  if (!isMobile) {
    await page.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .4);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .72, bounds.y + bounds.height * .4, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Reset Map', exact: true })).toBeVisible();
    await expect.poll(async () => Math.abs((await pin.boundingBox()).x - start.x)).toBeGreaterThan(30);
  }
  await expect(page.getByRole('link', { name: 'Open the Full Map', exact: true })).toHaveAttribute('href', '/map?view=map');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('homepage zoom reveals nearby places and reset restores the opening scale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [place, { ...place, id: 'neighbor', name: 'Nearby Herbs', urlSlug: 'nearby-herbs', longitude: -104.8 }] }));
  await page.goto('/');
  const map = page.getByRole('region', { name: 'Explore Little Herb Places on the Map', exact: true });
  const group = map.getByRole('button', { name: 'Explore 2 places in this area', exact: true });
  await expect(group).toBeVisible();
  const start = await group.boundingBox();
  for (let i = 0; i < 3; i++) await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Visit Nearby Herbs', exact: true })).toBeInViewport();
  await expect(map.getByRole('button', { name: 'Visit Moss Apothecary', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Reset Map', exact: true }).click();
  await expect(group).toBeVisible();
  await expect.poll(async () => Math.abs((await group.boundingBox()).x - start.x)).toBeLessThan(1);
  await map.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset Map', exact: true })).toBeVisible();
});
