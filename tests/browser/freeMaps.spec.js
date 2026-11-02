import { test, expect } from '@playwright/test';
import { emptyMapStyle, mockFreeMaps } from './fixtures/freeMaps';
import { getHeroMapLayout } from '../../src/utilities/heroMap';

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

test('homepage pins align with the actual renderer camera across world edges', async ({ page }, testInfo) => {
  test.skip(testInfo.config.configFile.endsWith('playwright.maps.config.js'), 'Camera instrumentation reads the development module; production rendering is covered separately.');
  const places = [place,
    { ...place, id: 'alaska', name: 'Alaska Herbs', longitude: -149, latitude: 61 },
    { ...place, id: 'hawaii', name: 'Hawaii Herbs', longitude: -155, latitude: 19 },
    { ...place, id: 'maine', name: 'Maine Herbs', longitude: -69, latitude: 44 },
  ];
  await page.route('**/rest/v1/**', route => route.fulfill({ json: places }));
  // Inspect the native camera without exposing debugging state in the application.
  await page.route('**/src/components/FreeMap/FreeMap.jsx', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('onLoad: loaded', 'onLoad: e => { window.testHeroMap = e.target; loaded(e); }');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const pins = page.getByRole('group', { name: 'Explore little places' });
  await expect(pins).toBeVisible();
  for (const width of [1440, 390, 3840]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => {
      const bounds = await pins.boundingBox();
      const layout = getHeroMapLayout(places, Math.round(bounds.width), Math.round(bounds.height), width <= 760);
      return pins.evaluate((element, coordinates) => {
        const buttons = [...element.querySelectorAll('button')];
        if (buttons.length !== coordinates.length) return Infinity;
        return Math.max(...coordinates.map(([longitude, latitude], i) => {
          const actual = window.testHeroMap.project([longitude, latitude]);
          return Math.hypot(parseFloat(buttons[i].style.left) - actual.x, parseFloat(buttons[i].style.top) - actual.y);
        }));
      }, layout.groups.map(group => [group.places[0].longitude, group.places[0].latitude]));
    }).toBeLessThan(1);
  }
});

test('homepage groups nearby places locally and lets visitors focus California or Arizona',async({page},testInfo)=>{
 const locations=[{...place,id:'el-paso',name:'El Paso Herbs',urlSlug:'el-paso-herbs',state:'Texas',city:'El Paso',latitude:31.76,longitude:-106.49},
 {...place,id:'tucson',name:'Tucson Herb Store',urlSlug:'tucson-herb-store',state:'Arizona',city:'Tucson',latitude:32.22,longitude:-110.97},
 {...place,id:'joshua',name:'Joshua Tree Herbs',urlSlug:'joshua-tree-herbs',state:'California',city:'Joshua Tree',latitude:34.13,longitude:-116.32},
 {...place,id:'palm',name:'Palm Springs Herbs',urlSlug:'palm-springs-herbs',state:'CA',city:'Palm Springs',latitude:33.82,longitude:-116.54},
 {...place,id:'la',name:'Los Angeles Herbs',urlSlug:'los-angeles-herbs',state:'California',city:'Los Angeles',latitude:34.07,longitude:-118.38},
 {...place,id:'hawaii',state:'Hawaii',city:'Hilo',latitude:19,longitude:-155}, {...place,id:'maine',state:'Maine',city:'Portland',latitude:44,longitude:-69}];
 await page.route('**/rest/v1/**',route=>route.fulfill({json:locations}));await page.goto('/');const pins=page.getByRole('group',{name:'Explore little places'});
 await expect(pins.getByRole('button',{name:'Visit Tucson Herb Store',exact:true})).toBeVisible();
 const region=page.getByRole('combobox',{name:'Explore the Map',exact:true});await expect(region.locator('option[value="California"]')).toHaveCount(1);
 await region.selectOption('California');await expect(page.getByRole('status').filter({hasText:'3 places in California'})).toBeVisible();await expect(pins.getByRole('button',{name:/Tucson/})).toHaveCount(0);await expect(pins.getByRole('button',{name:/Joshua Tree/})).toBeVisible();
 const href=await page.getByRole('link',{name:'Open the Full Map',exact:true}).getAttribute('href');expect(new URL(href,'http://localhost').searchParams.get('bounds')).toContain('-118.38');
 await region.selectOption('Arizona');await expect(pins.getByRole('button')).toHaveCount(1);await expect(pins.getByRole('button',{name:'Visit Tucson Herb Store',exact:true})).toBeVisible();
 await region.selectOption('');await expect(page.getByRole('status').filter({hasText:'7 places across the directory'})).toBeVisible();await expect(pins.getByRole('button',{name:'Visit Tucson Herb Store',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('regional-homepage-map.png'),fullPage:true,animations:'disabled'});
});
