import { policyPages } from '../../src/utilities/policyPages.js';
import { ownerSteps, planPages } from '../../src/utilities/planPages.js';
import { canonicalUrl, getPlaceSeo, getRouteSeo, publicRoutes, serializeJson, SITE_NAME, SITE_ORIGIN } from '../../src/utilities/seo.js';
import { getOpeningHours, getWebsiteUrl } from '../../src/utilities/placeDetails.js';
import { getPlaceCategories } from '../../src/utilities/placeFilters.js';
import { relatedPlaces } from '../../src/utilities/relatedPlaces.js';
import { browsePagePath, getBrowsePages } from '../../src/utilities/browse.js';
import { publicGrowth } from '../../src/utilities/placeGrowth.js';
import { discoveryItems } from '../../src/utilities/discovery.js';
import { getPlanFeatures, getBusinessPlans } from '../../src/utilities/planPages.js';

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
const navigation = `<nav aria-label="Main navigation">${link('/', SITE_NAME)} · ${link('/map/', 'Explore Places')} · ${link('/browse/', 'Browse by City')} · ${link('/about/', 'Our Story')} · ${link('/the-little-garden/', 'The Little Garden')}</nav>`;
const list = places => `<ul>${places.map(place => `<li>${link(`/place/${place.urlSlug}/`, place.name)} — ${escapeHtml([place.city, place.state].filter(Boolean).join(', '))}</li>`).join('')}</ul>`;
const staticStyles = `<style id="static-page-style">@font-face{font-family:Editorial;src:url('/assets/fonts/EditorialNew-Light.woff2')}#root>.static-page{max-width:1000px;margin:0 auto;padding:32px 6% 70px;color:#2c542f;font:16px/1.8 system-ui,sans-serif}#root>.static-page h1,#root>.static-page h2{font-family:Editorial,Georgia,serif;font-weight:200;line-height:1.2}#root>.static-page h1{font-size:clamp(40px,6vw,68px);margin:42px 0 20px}#root>.static-page h2{font-size:32px;margin-top:36px}#root>.static-page img{width:100%;max-height:480px;object-fit:contain;border-radius:24px;margin:24px 0}#root>.static-page a{color:inherit;text-decoration:underline}#root>.static-page nav{font-size:14px}#root>.static-page p{font-weight:400;line-height:1.8}#root>.static-page li{margin:10px 0}#root>.static-page .plan-notes{border-top:1px solid #dce5d1;margin-top:32px;padding-top:20px}#root>.static-page .plan-notes p{font-size:12px;line-height:1.7}</style>`;
export function renderPlaceContent(place, places) {
  const location = [place.city, place.state].filter(Boolean).join(', ');
  const website = getWebsiteUrl(place.website);
  const photo = getPlaceSeo(place).structuredData['@graph'][0].image[0];
  const hours = getOpeningHours(place.hours);
  const nearby = relatedPlaces(place, places);
  return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(place.name)}</h1><p>${escapeHtml(location)}</p>${place.tagline ? `<p>${escapeHtml(place.tagline)}</p>` : ''}<p>${getPlaceCategories(place).map(category => link(`/map/?category=${category.id}`, category.name)).join(' · ')}</p>${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(place.photo_alt?.[place.coverPhoto] || place.name)}" width="1200" height="700">` : ''}<h2>A Little About ${escapeHtml(place.name)}</h2>${String(place.description || '').split(/\n+/).filter(Boolean).map(text => `<p>${escapeHtml(text)}</p>`).join('')}<h2>Plan a Little Visit.</h2>${place.address ? `<h3>Address</h3><p>${escapeHtml([place.address, location, place.zip].filter(Boolean).join(', '))}</p>` : ''}${place.phone ? `<h3>Phone</h3><p>${link(`tel:${place.phone}`, place.phone)}</p>` : ''}${hours.length ? `<h3>Opening hours</h3><ul>${hours.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}${website ? `<p>${link(website, 'Visit Their Website')}</p>` : ''}${renderGrowthContent(place)}<h2>Keep Wandering.</h2>${list(nearby)}<p>${link('/map/', 'Explore All Places')}</p></main>`;
}
export function renderRouteContent(route, places, { growthEnabled = false, bloomAvailable = false, emailReportsEnabled = false } = {}) {
  if (route.path === '/browse' || route.path.startsWith('/browse/')) {
    const page = getBrowsePages(places).find(item => item.path === route.path);
    if (!page) return '';
    return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p>${page.collections?.length ? `<h2>Explore local collections</h2><ul>${page.collections.map(item => `<li>${link(`${item.path}/`, item.heading)} (${item.places.length} places)</li>`).join('')}</ul>` : ''}<h2>Places to get to know</h2>${list(page.places)}${page.pageCount > 1 ? `<nav aria-label="Browse pagination">${page.page > 1 ? link(`${browsePagePath(page.page - 1)}/`, 'Previous') : ''} Page ${page.page} of ${page.pageCount} ${page.page < page.pageCount ? link(`${browsePagePath(page.page + 1)}/`, 'Next') : ''}</nav>` : ''}<p>${link('/browse/', 'Browse every place and city')} · ${link('/map/', 'Explore the map')}</p></main>`;
  }
  if (route.path === '/the-little-garden') {
    const plans = getBusinessPlans({ growthEnabled, bloomAvailable, emailReportsEnabled });
    return `<main id="main-content" class="static-page">${navigation}<h1>The Little Garden</h1><h2>Help the right people choose your place.</h2><p>Start with a free business listing, build a useful profile with Bloom, and explore searchable offerings and events with the invitation-only Thrive pilot.</p>${plans.map(plan => `<section><h2>${escapeHtml(plan.name)} · ${escapeHtml(plan.price)}</h2><p>${escapeHtml(plan.description)}</p><ul>${plan.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}</ul><p>${link(plan.path, plan.action)}</p></section>`).join('')}<aside class="plan-notes" aria-label="Plan notes"><p>Claiming is free. Ownership approval comes before payment. Bloom checkout availability is shown on the site. Thrive is not available for purchase; an inquiry starts no payment or commitment.</p><p>${link('/membership-terms/', 'Membership Terms')} · ${link('/help/', 'Help & Billing')}</p></aside></main>`;
  }
  const policy = route.path === '/privacy' ? policyPages.privacy : route.path === '/membership-terms' ? policyPages.terms : null;
  if (policy) {
    const paragraphs = section => section.paragraphs.map(paragraph => `<p>${paragraph.map(part => typeof part === 'string' ? escapeHtml(part) : link(part.href, part.text)).join('')}</p>`).join('');
    return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(policy.title)}</h1>${policy.sections.map(section => `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs(section)}</section>`).join('')}<p>${link('/help/', 'Help & Billing')} · ${link(route.path === '/privacy' ? '/membership-terms/' : '/privacy/', route.path === '/privacy' ? 'Membership Terms' : 'Privacy')}</p></main>`;
  }
  const plan = Object.entries(planPages).find(([key]) => route.path === `/the-little-garden/${key}`);
  if (plan) {
    const [key, content] = plan;
    return `<main id="main-content" class="static-page">${navigation}<p>${link('/the-little-garden/', 'The Little Garden')} / ${escapeHtml(content.name)}</p><h1>${escapeHtml(content.heading)}</h1><p>${escapeHtml(content.intro)}</p><h2>${escapeHtml(content.name)} · $${content.price}</h2><p>${escapeHtml(content.priceNote)}</p><p>${key === 'thrive' ? 'Paid Thrive is coming soon. Ask about the invitation-only pilot. An inquiry does not start a subscription.' : 'Claiming is free. Ownership approval comes before payment. The site shows whether Bloom checkout is enabled.'}</p><h2>${escapeHtml(content.sectionTitle)}</h2><p>${escapeHtml(content.sectionIntro)}</p>${getPlanFeatures(key, growthEnabled, emailReportsEnabled).map(feature => `<h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(feature.text)}</p>`).join('')}<h2>${escapeHtml(content.showcaseTitle)}</h2><p>${escapeHtml(content.showcaseText)}</p><p>${escapeHtml(content.showcaseNote)}</p><h2>From finding your place to making it yours.</h2><ol>${ownerSteps.map(step => `<li><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p></li>`).join('')}</ol><p>${link(`/the-little-garden/start/?plan=${key}&new=1`, 'Request a Missing Listing')} · ${link('/my-places/', 'Open My Places')}</p><h2>A few things you might be wondering.</h2>${content.faqs.map(faq => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join('')}<p>${link(`/the-little-garden/start/?plan=${key}`, key === 'thrive' ? 'Start with Your Place' : 'Claim Your Place for Free')} · ${key === 'thrive' ? link('mailto:help@littleherbplaces.com?subject=Thrive%20inquiry', 'Ask About the Thrive Pilot') : ''}</p><p>${link(`/the-little-garden/${key === 'thrive' ? 'bloom' : 'thrive'}/`, key === 'thrive' ? 'Explore Bloom' : 'Explore Thrive')} · ${link('/membership-terms/', 'Membership Terms')}</p></main>`;
  }
  return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(route.heading || route.title)}</h1><p>${escapeHtml(route.description)}</p>${['/', '/map'].includes(route.path) ? `<h2>Somewhere Worth Finding.</h2>${list(places.slice(0, route.path === '/' ? 3 : 15))}` : ''}${route.path === '/help' ? `<p>${link('mailto:help@littleherbplaces.com', 'help@littleherbplaces.com')}</p>` : ''}<p>${link('/browse/', 'Browse all places by city')} · ${link('/map/', 'Explore Places')}</p></main>`;
}
export function renderPage(template, seo, content) {
  if (!template.includes('<!-- seo:start -->') || !template.includes('<div id="root"></div>')) throw new Error('The build template is missing SEO placeholders.');
  return template.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, `<!-- seo:start -->\n${renderSeoHead(seo)}\n<!-- seo:end -->`)
    .replace('<div id="root"></div>', `${staticStyles}<div id="root">${content}</div>`);
}
export function renderSitemap(places) {
  const discoveries = discoveryItems(places, places.map(place => place.growth).filter(Boolean));
  const entries = [...new Set([...publicRoutes.map(route => route.path), ...getBrowsePages(places).map(route => route.path), ...(discoveries.length ? ['/discover', ...discoveries.map(item => item.path)] : [])])].map(path => ({ url: canonicalUrl(path) })).concat(places.map(place => ({ url: getPlaceSeo(place).canonical, updated: place.updated_at })));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${escapeHtml(entry.url)}</loc>${entry.updated && Number.isFinite(Date.parse(entry.updated)) ? `<lastmod>${new Date(entry.updated).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`;
}
export const robotsText = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
export const notFoundSeo = () => ({ ...getRouteSeo('/404'), title: `Page Not Found | ${SITE_NAME}`, structuredData: null });

export function renderGrowthContent(place) {
  if (!place.growth) return '';
  const content = publicGrowth(place.growth);
  const items = discoveryItems([place], [place.growth]);
  const a = content.announcement;
  return `${place.growth.operating_status !== 'open' ? `<p>${escapeHtml(place.growth.operating_status === 'permanently_closed' ? 'Reported permanently closed' : 'Temporarily closed')}. Confirm directly before visiting.</p>` : ''}${content.primary_action?.url ? `<p>${link(content.primary_action.url, content.primary_action.label)}</p>` : ''}${content.specialties.length ? `<h2>What you’ll find here</h2><p>${content.specialties.map(escapeHtml).join(' · ')}</p>` : ''}${content.languages ? `<p>Languages: ${escapeHtml(content.languages)}</p>` : ''}${content.access_notes ? `<p>Access information from the business: ${escapeHtml(content.access_notes)}</p>` : ''}${a ? `<section><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.body)}</p>${a.code ? `<p>Offer code: ${escapeHtml(a.code)}</p>` : ''}${a.url ? link(a.url, 'Learn More') : ''}</section>` : ''}${items.length ? `<h2>Offerings & upcoming events</h2><ul>${items.map(item => `<li>${link(`${item.path}/`, item.title)} — ${escapeHtml(item.description)}</li>`).join('')}</ul>` : ''}`;
}

export function renderDiscoveryContent(places, item = null) {
  const items = discoveryItems(places, places.map(place => place.growth).filter(Boolean));
  if (!item) return `<main id="main-content" class="static-page">${navigation}<h1>Herbal products, services & workshops</h1><p>Explore offerings from independent businesses. Shop, book, and register directly with each business.</p>${items.length ? `<ul>${items.map(entry => `<li>${link(`${entry.path}/`, entry.title)} — ${escapeHtml(entry.place.name)} · ${escapeHtml([entry.place.city, entry.place.state].filter(Boolean).join(', '))}</li>`).join('')}</ul>` : '<p>Our first Thrive businesses are preparing their offerings.</p>'}</main>`;
  return `<main id="main-content" class="static-page">${navigation}<h1>${escapeHtml(item.title)}</h1><p>From ${link(`/place/${item.place.urlSlug}/`, item.place.name)}</p>${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.image_alt || item.title)}" width="600" height="450">` : ''}<p>${escapeHtml(item.description)}</p>${item.event ? `<p><time datetime="${escapeHtml(item.starts_at)}">${escapeHtml(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone }).format(new Date(item.starts_at)))}</time> · ${escapeHtml(item.timezone)} · ${escapeHtml(item.location)}</p>` : ''}${item.price ? `<p>${escapeHtml(item.price)}</p>` : ''}<p>${link(item.url, item.event ? 'Details & Registration' : 'Shop or Book Directly')}</p><p>${link('/discover/', 'Explore all offerings and events')}</p></main>`;
}
