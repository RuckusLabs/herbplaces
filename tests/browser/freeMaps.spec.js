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

test('homepage clusters zoom in place and reset to the full directory overview', async ({ page }) => {
  const locations = [place,
    { ...place, id: 'la', name: 'Los Angeles Herbs', urlSlug: 'los-angeles-herbs', longitude: -118.38, latitude: 34.07 },
    { ...place, id: 'long-beach', name: 'Long Beach Herbs', longitude: -118.19, latitude: 33.77 },
    { ...place, id: 'london', name: 'London Herbs', longitude: -.12, latitude: 51.5 },
    { ...place, id: 'tokyo', name: 'Tokyo Herbs', longitude: 139.69, latitude: 35.68 },
    { ...place, id: 'sydney', name: 'Sydney Herbs', longitude: 151.2, latitude: -33.86 },
    { ...place, id: 'cape-town', name: 'Cape Town Herbs', longitude: 18.42, latitude: -33.92 },
  ];
  await page.route('**/rest/v1/**', route => route.fulfill({ json: locations }));
  await page.goto('/');
  const map = page.getByRole('region', { name: 'Explore Little Herb Places Around the World', exact: true });
  await expect(map.getByText(/^7 Little Herb Places/)).toBeVisible();
  await expect(map.getByRole('button', { name: 'Visit London Herbs' })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Visit Sydney Herbs' })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Visit Tokyo Herbs' })).toBeVisible();
  const cluster = map.getByRole('button', { name: /Zoom in to \d+ Little Herb Places/ }).first();
  await expect(cluster).toBeVisible();
  await cluster.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Explore This Area', exact: true })).toHaveAttribute('href', /bounds=/);
  const localGroup = map.getByRole('button', { name: 'Zoom in to 2 Little Herb Places', exact: true });
  await expect(localGroup).toBeVisible();
  await localGroup.click();
  await expect(map.getByRole('button', { name: 'Visit Los Angeles Herbs' })).toBeVisible();
  await page.getByRole('button', { name: 'Show All Places', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open the Full Map', exact: true })).toHaveAttribute('href', '/map?view=map');
  await expect(map.getByRole('button', { name: 'Visit Sydney Herbs' })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Visit London Herbs' })).toBeVisible();
  await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show All Places', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
