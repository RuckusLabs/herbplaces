import { canonicalUrl, getPlaceSeo, getRouteSeo, publicRoutes, serializeJson, SITE_NAME, SITE_ORIGIN } from '../../src/utilities/seo.js';
import { getOpeningHours, getWebsiteUrl } from '../../src/utilities/placeDetails.js';
import { getPlaceCategories } from '../../src/utilities/placeFilters.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function renderSeoHead(seo) {
  const attr = ' data-react-helmet="true"';
  const meta = (key, value, property = false) => `<meta${attr} ${property ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}">`;
  return [ `<title>${escapeHtml(seo.title)}</title>`, meta('description', seo.description), meta('robots', seo.robots), `<link${attr} rel="canonical" href="${escapeHtml(seo.canonical)}">`,
    ...Object.entries({ type: seo.type, site_name: SITE_NAME, title: seo.title, description: seo.description, url: seo.canonical, image: seo.image, 'image:width': 1200, 'image:height': 630, 'image:type': 'image/jpeg', 'image:alt': seo.imageAlt }).map(([key, value]) => meta(`og:${key}`, value, true)),
    ...Object.entries({ card: 'summary_large_image', title: seo.title, description: seo.description, image: seo.image, 'image:alt': seo.imageAlt }).map(([key, value]) => meta(`twitter:${key}`, value)),
    ...(seo.structuredData ? [`<script${attr} type="application/ld+json">${serializeJson(seo.structuredData)}</script>`] : []),
  ].join('\n');
}
const link = (href, title) => `<a href="${escapeHtml(href)}">${escapeHtml(title)}</a>`;
const navigation = `<nav aria-label="Main navigation">${link('/', SITE_NAME)} · ${link('/map/', 'Explore Places')} · ${link('/about/', 'Our Story')} · ${link('/the-little-garden/', 'The Little Garden')}</nav>`;
const list = places => `<ul>${places.map(place => `<li>${link(`/place/${place.urlSlug}/`, place.name)} — ${escapeHtml([place.city, place.state].filter(Boolean).join(', '))}</li>`).join('')}</ul>`;
const staticStyles = `<style id="static-page-style">@font-face{font-family:Editorial;src:url('/assets/fonts/EditorialNew-Light.woff2')}#root>.static-page{max-width:1000px;margin:0 auto;padding:32px 6% 70px;color:#2c542f;font:16px/1.8 system-ui,sans-serif}#root>.static-page h1,#root>.static-page h2{font-family:Editorial,Georgia,serif;font-weight:200;line-height:1.2}#root>.static-page h1{font-size:clamp(40px,6vw,68px);margin:42px 0 20px}#root>.static-page h2{font-size:32px;margin-top:36px}#root>.static-page img{width:100%;max-height:480px;object-fit:contain;border-radius:24px;margin:24px 0}#root>.static-page a{color:inherit;text-decoration:underline}#root>.static-page nav{font-size:14px}#root>.static-page p{font-weight:400;line-height:1.8}#root>.static-page li{margin:10px 0}</style>`;
export function renderPlaceContent(place, places) {
  const location = [place.city, place.state].filter(Boolean).join(', ');
  const website = getWebsiteUrl(place.website);
  const photo = getPlaceSeo(place).structuredData['@graph'][0].image[0];
  const hours = getOpeningHours(place.hours);
  const nearby = places.filter(other => other.urlSlug !== place.urlSlug).sort((a, b) => Number(b.state === place.state) - Number(a.state === place.state)).slice(0, 3);
  return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(place.name)}</h1><p>${escapeHtml(location)}</p>${place.tagline ? `<p>${escapeHtml(place.tagline)}</p>` : ''}<p>${getPlaceCategories(place).map(category => link(`/map/?category=${category.id}`, category.name)).join(' · ')}</p>${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(place.photo_alt?.[place.coverPhoto] || place.name)}" width="1200" height="700">` : ''}<h2>A Little About ${escapeHtml(place.name)}</h2>${String(place.description || '').split(/\n+/).filter(Boolean).map(text => `<p>${escapeHtml(text)}</p>`).join('')}<h2>Plan a Little Visit.</h2>${place.address ? `<h3>Address</h3><p>${escapeHtml([place.address, location, place.zip].filter(Boolean).join(', '))}</p>` : ''}${place.phone ? `<h3>Phone</h3><p>${link(`tel:${place.phone}`, place.phone)}</p>` : ''}${hours.length ? `<h3>Opening hours</h3><ul>${hours.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}${website ? `<p>${link(website, 'Visit Their Website')}</p>` : ''}<h2>Keep Wandering.</h2>${list(nearby)}<p>${link('/map/', 'Explore All Places')}</p></main>`;
}
export function renderRouteContent(route, places) {
  return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(route.heading || route.title)}</h1><p>${escapeHtml(route.description)}</p>${['/', '/map'].includes(route.path) ? `<h2>Somewhere Worth Finding.</h2>${list(places.slice(0, route.path === '/' ? 3 : 15))}` : ''}${route.path === '/help' ? `<p>${link('mailto:help@littleherbplaces.com', 'help@littleherbplaces.com')}</p>` : ''}<p>${link('/map/', 'Explore Places')}</p></main>`;
}
export function renderPage(template, seo, content) {
  if (!template.includes('<!-- seo:start -->') || !template.includes('<div id="root"></div>')) throw new Error('The build template is missing SEO placeholders.');
  return template.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, `<!-- seo:start -->\n${renderSeoHead(seo)}\n<!-- seo:end -->`)
    .replace('<div id="root"></div>', `${staticStyles}<div id="root">${content}</div>`);
}
export function renderSitemap(places) {
  const entries = publicRoutes.map(route => ({ url: canonicalUrl(route.path) })).concat(places.map(place => ({ url: getPlaceSeo(place).canonical, updated: place.updated_at })));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${escapeHtml(entry.url)}</loc>${entry.updated && Number.isFinite(Date.parse(entry.updated)) ? `<lastmod>${new Date(entry.updated).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`;
}
export const robotsText = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
export const notFoundSeo = () => ({ ...getRouteSeo('/404'), title: `Page Not Found | ${SITE_NAME}`, structuredData: null });
