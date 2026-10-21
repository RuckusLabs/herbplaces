import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteImage, canonicalUrl, publicRoutes, getPlaceSeo, getRouteSeo, serializeJson, shareImagePath, sitePageCards, siteShareImagePath, validSlug } from '../utilities/seo.js';
import { renderPage, renderPlaceContent, renderRouteContent, renderSeoHead, renderSitemap, robotsText } from '../../scripts/seo/render.mjs';

const place = { id: 1, name: 'Moss & Fern', urlSlug: 'moss-and-fern', tagline: 'A little care, rooted in plants.', city: 'Denver', state: 'CO', address: '123 Main Street', zip: '80201', phone: '303-555-0142', website: 'https://example.com', description: 'Teas and community workshops.', photos: ['/assets/pages/home/hero.jpg'], coverPhoto: '/assets/pages/home/hero.jpg', category_ids: ['shops'], latitude: 39.7, longitude: -104.9, updated_at: '2026-10-19T12:00:00Z' };
const template = '<html><head><!-- seo:start --><!-- seo:end --></head><body><div id="root"></div><script src="/app.js"></script></body></html>';

test('place metadata uses its own title, description, absolute share image, and canonical URL', () => {
  const seo = getPlaceSeo(place);
  assert.equal(seo.title, 'Moss & Fern in Denver, CO | Little Herb Places');
  assert.equal(seo.canonical, 'https://littleherbplaces.com/place/moss-and-fern/');
  assert.equal(canonicalUrl('/map/'), 'https://littleherbplaces.com/map/');
  assert.match(seo.image, /^https:\/\/littleherbplaces.com\/og\/places\/moss-and-fern-[0-9a-f]+\.jpg$/);
  assert.notEqual(shareImagePath(place), shareImagePath({ ...place, name: 'New Name' }));
  assert.equal(getPlaceSeo({ ...place, city: '', state: '' }).title, 'Moss & Fern | Little Herb Places');
});
test('website pages have their own share cards, including non-indexable account pages', () => {
  assert.equal(sitePageCards.length, 12);
  assert.equal(new Set(sitePageCards.map(siteShareImagePath)).size, 12);
  for (const page of sitePageCards) assert.equal(getRouteSeo(`${page.path}/`).image, `https://littleherbplaces.com${siteShareImagePath(page)}`);
  assert.notEqual(getRouteSeo('/about').image, getRouteSeo('/map').image);
  assert.equal(getRouteSeo('/login').robots, 'noindex,follow');
});
test('structured data describes the actual place and never invents reviews or hours', () => {
  const graph = getPlaceSeo(place).structuredData['@graph'];
  assert.equal(graph[0]['@type'], 'LocalBusiness');
  assert.equal(graph[0].address.streetAddress, place.address);
  assert.deepEqual(graph[0].geo, { '@type': 'GeoCoordinates', latitude: 39.7, longitude: -104.9 });
  assert.equal(graph[2].itemListElement.length, 3);
  assert.equal(graph[0].aggregateRating, undefined);
  assert.equal(graph[0].openingHoursSpecification, undefined);
  const missing = getPlaceSeo({ ...place, category_ids: ['gardens'], latitude: null, longitude: null }).structuredData['@graph'][0];
  assert.equal(missing['@type'], 'Place');
  assert.equal(missing.geo, undefined);
});
test('private pages, missing routes, and faceted searches do not get indexed', () => {
  for (const path of ['/login', '/admin', '/favorites', '/unknown']) assert.equal(getRouteSeo(path).robots, 'noindex,follow');
  assert.equal(getRouteSeo('/map/', '?lat=39&lng=-105').robots, 'noindex,follow');
  assert.equal(getRouteSeo('/map/').robots, 'index,follow');
  assert.equal(getRouteSeo('/place/moss-and-fern/').robots, 'index,follow');
});
test('initial HTML contains usable place content and crawler metadata without JavaScript', () => {
  const html = renderPage(template, getPlaceSeo(place), renderPlaceContent({ ...place, hours: 'Monday: 10–6; Tuesday: closed' }, [place]));
  assert.match(html, /<h1>Moss &amp; Fern<\/h1>/);
  assert.match(html, /property="og:title" content="Moss &amp; Fern in Denver/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /<li>Monday: 10–6<\/li>/);
  assert.match(html, /123 Main Street/);
  assert.match(html, /<script src="\/app.js"><\/script>/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.throws(() => renderPage('<html></html>', getPlaceSeo(place), ''), /placeholders/);
});
test('untrusted listing text is escaped in HTML and structured data', () => {
  const malicious = { ...place, name: '</script><script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' };
  const html = renderPage(template, getPlaceSeo(malicious), renderPlaceContent(malicious, []));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(serializeJson({ name: malicious.name }).includes('\\u003c/script'));
  assert.match(renderSeoHead(getPlaceSeo(place)), /data-react-helmet="true"/);
  assert.equal(absoluteImage('http://['), null);
  for (const slug of ['../admin', 'a/b', 'A Place', '', null]) assert.equal(validSlug(slug), false);
});
test('sitemaps list canonical public URLs and real modification dates only', () => {
  const sitemap = renderSitemap([place]);
  assert.match(sitemap, /<loc>https:\/\/littleherbplaces.com\/place\/moss-and-fern\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-10-19T12:00:00.000Z<\/lastmod>/);
  assert.ok(!sitemap.includes('/admin'));
  assert.ok(!renderSitemap([{ ...place, updated_at: 'bad' }]).includes('<lastmod>'));
  assert.match(robotsText, /Sitemap: https:\/\/littleherbplaces.com\/sitemap.xml/);
});

test('business plan pages are discoverable with full sales content before JavaScript loads', () => {
  const sitemap = renderSitemap([]);
  for (const plan of ['bloom', 'thrive']) {
    const path = `/the-little-garden/${plan}`;
    const route = publicRoutes.find(item => item.path === path);
    const seo = getRouteSeo(path);
    assert.equal(seo.robots, 'index,follow');
    assert.match(sitemap, new RegExp(`${path}/`));
    const html = renderPage(template, seo, renderRouteContent(route, []));
    assert.match(html, /Claim your listing/);
    assert.match(html, /Listing approval does not automatically approve you as a manager|Adding a listing and approving its managers are separate steps/);
    assert.match(html, /Membership Terms/);
    assert.match(html, plan === 'bloom' ? /up to 20 photos/ : /proposed pilot price/);
    assert.match(html, plan === 'bloom' ? /\$19/ : /\$49/);
  }
});
