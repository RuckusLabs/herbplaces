import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { chromium } from 'playwright';
import { getPlaceSeo, getRouteSeo, privateRoutes, publicRoutes, shareImagePath, sitePageCards, siteShareImagePath } from '../src/utilities/seo.js';
import { directoryHash, fetchPublicPlaces, validatePlaces } from './seo/directory.mjs';
import { escapeHtml, notFoundSeo, renderPage, renderPlaceContent, renderRouteContent, renderSitemap, renderDiscoveryContent, robotsText } from './seo/render.mjs';
import { shareCardHtml } from './seo/share-card.mjs';
import { getBrowsePages } from '../src/utilities/browse.js';
import { canonicalUrl, getDiscoverySeo } from '../src/utilities/seo.js';
import { discoveryItems } from '../src/utilities/discovery.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
async function fetchPlaces() {
  const fixture = argument('--places') || env.SEO_PLACES_FILE;
  if (fixture) return JSON.parse(await fs.readFile(fixture, 'utf8'));
  return fetchPublicPlaces(env);
}
const dataUri = (bytes, type) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const fallbackPhoto = dataUri(await fs.readFile(path.join(root, 'public/assets/pages/home/hero.jpg')), 'image/jpeg');
async function photoFor(place) {
  const value = place.coverPhoto || place.photos?.[0];
  if (!value) return fallbackPhoto;
  try {
    const url = new URL(value);
    // Listing photos come from public Storage, not arbitrary servers or local network URLs.
    if (url.protocol !== 'https:' || url.origin !== new URL(env.VITE_SUPABASE_URL).origin || !url.pathname.startsWith('/storage/v1/object/public/')) return fallbackPhoto;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type) || Number(response.headers.get('content-length')) > 10 * 1024 * 1024) throw new Error('Photo unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Photo too large');
    return dataUri(bytes, type);
  } catch { console.warn(`Using the botanical fallback photo for ${place.urlSlug}.`); return fallbackPhoto; }
}
async function write(relative, contents) {
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}
const template = await fs.readFile(path.join(output, 'index.html'), 'utf8');
const places = validatePlaces(await fetchPlaces());
// A Vite build cleans dist first, so removed places never leave stale pages behind.
const font = dataUri(await fs.readFile(path.join(root, 'public/assets/fonts/EditorialNew-Light.woff2')), 'font/woff2');
const logoSource = (await fs.readFile(path.join(root, 'public/assets/little-herb-places-logo.svg'), 'utf8')).replace('<svg ', '<svg fill="#2c542f" ');
const logo = dataUri(logoSource, 'image/svg+xml');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route('**/*', route => route.abort()); // Cards use embedded assets only.
  async function card(place, imagePath, photo) {
    await page.setContent(shareCardHtml(place, { photo, font, logo }));
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
      const title = document.querySelector('h1');
      let size = 70;
      while (title.scrollHeight > 225 && size > 38) { size -= 2; title.style.fontSize = `${size}px`; }
      if (title.scrollHeight > 225) throw new Error('Share card title does not fit.');
    });
    await write(imagePath.replace(/^\//, ''), await page.screenshot({ type: 'jpeg', quality: 90 }));
  }
  for (const sitePage of sitePageCards) {
    const image = dataUri(await fs.readFile(path.join(root, 'public', sitePage.photo)), sitePage.photo.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    await card(sitePage, siteShareImagePath(sitePage), image);
  }
  // Keep older generic share-image links usable after the new page cards ship.
  await fs.copyFile(path.join(output, siteShareImagePath(sitePageCards[0]).slice(1)), path.join(output, 'og/site.jpg'));
  for (const place of places) {
    await card(place, shareImagePath(place), await photoFor(place));
    await write(`place/${place.urlSlug}/index.html`, renderPage(template, getPlaceSeo(place), renderPlaceContent(place, places)));
  }
} finally { await browser.close(); }
for (const route of publicRoutes) await write(route.path === '/' ? 'index.html' : `${route.path.slice(1)}/index.html`, renderPage(template, getRouteSeo(route.path), renderRouteContent(route, places, { growthEnabled: env.VITE_GROWTH_ENABLED === 'true', bloomAvailable: env.VITE_BLOOM_ENABLED === 'true', emailReportsEnabled: env.VITE_ACTIVITY_REPORTS_ENABLED === 'true' })));
for (const route of getBrowsePages(places)) await write(`${route.path.slice(1)}/index.html`, renderPage(template,
  { ...getRouteSeo(route.path), title: `${route.heading} | Little Herb Places`, description: route.description, canonical: canonicalUrl(route.path), robots: 'index,follow' }, renderRouteContent(route, places)));
const discoveries = discoveryItems(places, places.map(place => place.growth).filter(Boolean));
await write('discover/index.html', renderPage(template, { ...getRouteSeo('/discover'), title: 'Herbal Products, Services & Workshops | Little Herb Places', description: 'Discover products, herbal consultations, workshops, and events from independent herb businesses. Shop or book directly with each business.', robots: discoveries.length ? 'index,follow' : 'noindex,follow' }, renderDiscoveryContent(places)));
for (const item of discoveries) await write(`${item.path.slice(1)}/index.html`, renderPage(template, getDiscoverySeo(item), renderDiscoveryContent(places, item)));
for (const route of privateRoutes) await write(`${route.slice(1)}/index.html`, renderPage(template, getRouteSeo(route), ''));
await write('404.html', renderPage(template, notFoundSeo(), '<main class="static-page"><h1>A Little Off the Beaten Path.</h1><p>This page could not be found. <a href="/map/">Explore the directory</a>.</p></main>'));
await write('robots.txt', robotsText);
await write('sitemap.xml', renderSitemap(places));
await write('.nojekyll', '');
await write('CNAME', 'littleherbplaces.com\n');
await write('seo-content-hash.txt', `${directoryHash(places)}\n`);
const previewCards = cards => cards.map(({ name, image }) => `<article><h3>${escapeHtml(name)}</h3><a href="${image}"><img src="${image}" alt="${escapeHtml(name)} share card" width="1200" height="630" loading="lazy"></a></article>`).join('');
await write('og/preview.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Share Cards | Little Herb Places</title><style>body{margin:0;padding:40px 5%;background:#f7f9f1;color:#2c542f;font-family:system-ui,sans-serif}h1,h2{font-family:Georgia,serif;font-weight:400}h2{margin-top:48px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:28px}article{min-width:0}img{display:block;width:100%;height:auto;border-radius:12px;box-shadow:0 4px 18px #2c542f15}a{color:inherit}h3{font-size:17px;font-weight:500}</style></head><body><h1>Somewhere Worth Sharing.</h1><p>1200 × 630 share cards. Select a card to view it at full size.</p><h2>Website Pages · ${sitePageCards.length}</h2><main>${previewCards(sitePageCards.map(page => ({ name: page.name, image: siteShareImagePath(page) })))}</main><h2>Little Places · ${places.length}</h2><main>${previewCards(places.map(place => ({ name: place.name, image: shareImagePath(place) })))}</main></body></html>`);
console.log(`Generated ${places.length} place cards, ${sitePageCards.length} webpage cards, static pages, sitemap.xml, and robots.txt.`);
