import { planPages } from './planPages.js';
import { getPlaceCategories } from './placeFilters.js';
import { getPlacePhotos, getWebsiteUrl } from './placeDetails.js';

export const SITE_ORIGIN = 'https://littleherbplaces.com';
export const SITE_NAME = 'Little Herb Places';
export const DEFAULT_DESCRIPTION = 'Discover independent herb shops, apothecaries, herbalists, and gardens. Find your next little herb place and connect with a community rooted in nature.';
export const publicRoutes = [
  ...Object.entries(planPages).map(([key, plan]) => ({ path: `/the-little-garden/${key}`, title: plan.title, heading: plan.heading, description: plan.description })),
  { path: '/', title: 'Little Herb Places — Find your connection to nature', heading: 'Find Your Little Herb Place.', description: DEFAULT_DESCRIPTION },
  { path: '/map', title: 'Explore Places | Little Herb Places', heading: 'Explore Little Herb Places', description: 'Find independent herb shops, herbalists, gardens, and plant-loving communities. Explore the directory and discover a little place near you.' },
  { path: '/about', title: 'Our Story | Little Herb Places', heading: 'Small Places, Big Heart.', description: 'Meet Little Herb Places: a guide to independent herb shops, herbalists, gardens, and the people who connect us through a love of plants.' },
  { path: '/the-little-garden', title: 'The Little Garden | Little Herb Places', heading: 'The Little Garden.', description: 'Manage your business listing on Little Herb Places. Learn how free ownership claims, Bloom subscriptions, and the upcoming Thrive pilot work.' },
  { path: '/help', title: 'Help & Billing | Little Herb Places', heading: 'A Little Help Along the Way.', description: 'Help with accounts, ownership claims, listing requests, Bloom billing, and cancellation at Little Herb Places.' },
  { path: '/privacy', title: 'Privacy at Little Herb Places', heading: 'Privacy at Little Herb Places', description: 'How Little Herb Places handles account information, ownership details, public listings, and payments.' },
  { path: '/membership-terms', title: 'Membership Terms | Little Herb Places', heading: 'Membership Terms', description: 'Membership, ownership claims, subscription renewal, cancellation, and listing content at Little Herb Places.' },
];
export const privateRoutes = ['/the-little-garden/start', '/login', '/register', '/favorites', '/my-places', '/admin', '/auth/callback', '/auth/forgot-password', '/auth/reset-password', '/auth/resend-confirmation', '/request-place', '/the-little-garden/sprout', '/shop'];
export const sitePageCards = [
  { path: '/', slug: 'home', name: 'Find Your Little Herb Place.', tagline: 'Herb shops, herbalists, gardens, and good company.', button: 'Explore Places', photo: '/assets/pages/home/hero.jpg' },
  { path: '/map', slug: 'explore', name: 'Somewhere Good Is Growing.', tagline: 'Find independent herb shops, plant people, and spaces to put down roots.', button: 'Explore The Map', photo: '/assets/pages/home/herb-image-2.jpg' },
  { path: '/about', slug: 'our-story', name: 'Rooted in Plants. Connected by People.', tagline: 'A little curiosity can lead to a wonderful place.', button: 'Read Our Story', photo: '/assets/pages/home/herb-image-1.jpg' },
  { path: '/the-little-garden', slug: 'the-little-garden', name: 'The Little Garden.', tagline: 'A place to share, grow, and be seen.', button: 'Come Grow With Us', photo: '/assets/pages/the-little-garden/garden.webp' },
  { path: '/help', slug: 'help', name: 'A Little Help Along the Way.', tagline: 'Questions about a place, your account, or the community? We’re here to help.', button: 'Get In Touch', photo: '/assets/pages/home/herb-image-1.jpg' },
  { path: '/the-little-garden/sprout', slug: 'join-sprout', name: 'Every Good Thing Starts With a Little Seed.', tagline: 'Join Sprout, our free community plan, and make a little room for connection.', button: 'Join Sprout', photo: '/assets/pages/the-little-garden/garden.webp' },
  { path: '/register', slug: 'join-the-community', name: 'Good Things Grow With Good Company.', tagline: 'Join the community and keep your favorite little discoveries close.', button: 'Join The Community', photo: '/assets/pages/home/herb-image-1.jpg' },
  { path: '/login', slug: 'sign-in', name: 'Welcome Back.', tagline: 'Your saved places and little discoveries are waiting for you.', button: 'Sign In', photo: '/assets/pages/home/hero.jpg' },
  { path: '/favorites', slug: 'saved-places', name: 'Your Little Discoveries.', tagline: 'Places to come back to, whenever you’re ready.', button: 'Explore Places', photo: '/assets/pages/home/herb-image-2.jpg' },
  { path: '/shop', slug: 'shop', name: 'Good Things Are Growing.', tagline: 'A little more plant-loving goodness is taking root.', button: 'Explore Places', photo: '/assets/pages/home/herb-image-1.jpg' },
  ...Object.entries(planPages).map(([key, plan]) => ({ path: `/the-little-garden/${key}`, slug: key, name: plan.heading, tagline: plan.description, button: key === 'bloom' ? 'Explore Bloom' : 'Meet the Thrive Pilot', photo: plan.heroPhoto })),
];
const cardHash = input => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
};
export const siteShareImagePath = page => `/og/pages/${page.slug}-${cardHash(JSON.stringify(['card-v2', page.name, page.tagline, page.button, page.photo]))}.jpg`;
export const normalizePath = path => path.replace(/\/+$/, '') || '/';
export const canonicalUrl = path => `${SITE_ORIGIN}${normalizePath(path) === '/' ? '/' : `${normalizePath(path)}/`}`;
export const absoluteImage = value => { try { return getWebsiteUrl(new URL(value || '/assets/pages/home/hero.jpg', SITE_ORIGIN).href); } catch { return null; } };
export const serializeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
export const validSlug = slug => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 200;
const shorten = (value, limit = 165) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length <= limit ? text : `${text.slice(0, limit - 1).replace(/\s+\S*$/, '')}…`; };

export function shareImagePath(place) {
  // Deterministic across the browser and build; new content gets a new image URL.
  const input = JSON.stringify(['card-v2', place.name, place.tagline, place.city, place.state, place.coverPhoto, place.content_version, place.updated_at]);
  return `/og/places/${place.urlSlug}-${cardHash(input)}.jpg`;
}

export function getRouteSeo(pathname, search = '') {
  const path = normalizePath(pathname);
  const route = publicRoutes.find(item => item.path === path);
  const placeRoute = path.startsWith('/place/') && validSlug(path.slice('/place/'.length));
  const shareCard = sitePageCards.find(page => page.path === path) || sitePageCards[0];
  const title = route?.title || (shareCard.path === path ? `${shareCard.name} | ${SITE_NAME}` : SITE_NAME);
  const params = new URLSearchParams(search);
  const filtered = path === '/map' && [...params.keys()].some(key => ['q', 'category', 'lat', 'lng', 'bounds', 'place', 'page'].includes(key));
  return { title, description: route?.description || shareCard.tagline || DEFAULT_DESCRIPTION, canonical: canonicalUrl(path), image: `${SITE_ORIGIN}${siteShareImagePath(shareCard)}`, imageAlt: `${shareCard.name} — ${SITE_NAME}`,
    robots: !route && !placeRoute || filtered ? 'noindex,follow' : 'index,follow', type: 'website',
    structuredData: path === '/' ? { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: SITE_NAME, url: `${SITE_ORIGIN}/`, logo: `${SITE_ORIGIN}/assets/little-herb-places-logo.svg` },
      { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: SITE_NAME, url: `${SITE_ORIGIN}/`, publisher: { '@id': `${SITE_ORIGIN}/#organization` } },
    ] } : null };
}

export function getPlaceSeo(place) {
  const location = [place.city, place.state].filter(Boolean).join(', ');
  const canonical = canonicalUrl(`/place/${place.urlSlug}`);
  const description = shorten(place.tagline || place.description || `Discover ${place.name}${location ? ` in ${location}` : ''}. Plan your visit with Little Herb Places.`);
  const images = getPlacePhotos(place).map(absoluteImage).filter(Boolean);
  const categories = getPlaceCategories(place);
  const business = !!place.address && !!place.city && categories.some(category => ['shops', 'herbalists', 'workshops'].includes(category.id));
  const entity = { '@type': business ? 'LocalBusiness' : 'Place', '@id': `${canonical}#place`, name: place.name, description, url: getWebsiteUrl(place.website) || canonical, image: images, mainEntityOfPage: { '@id': canonical } };
  if (place.address || place.city) entity.address = { '@type': 'PostalAddress', ...(place.address && { streetAddress: place.address }), ...(place.city && { addressLocality: place.city }), ...(place.state && { addressRegion: place.state }), ...(place.zip && { postalCode: place.zip }) };
  if (place.phone) entity.telephone = place.phone;
  if ([place.latitude, place.longitude].every(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) && Math.abs(Number(place.latitude)) <= 90 && Math.abs(Number(place.longitude)) <= 180) entity.geo = { '@type': 'GeoCoordinates', latitude: Number(place.latitude), longitude: Number(place.longitude) };
  const sameAs = (place.social_links || []).map(link => getWebsiteUrl(link.url)).filter(Boolean);
  if (sameAs.length) entity.sameAs = sameAs;
  return { title: `${place.name}${location ? ` in ${location}` : ''} | ${SITE_NAME}`, description, canonical, image: `${SITE_ORIGIN}${shareImagePath(place)}`, imageAlt: `${place.name}${location ? ` · ${location}` : ''} — ${SITE_NAME}`, robots: 'index,follow', type: 'website',
    structuredData: { '@context': 'https://schema.org', '@graph': [entity,
      { '@type': 'WebPage', '@id': canonical, url: canonical, name: place.name, description, about: { '@id': entity['@id'] } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Explore Places', item: canonicalUrl('/map') },
        { '@type': 'ListItem', position: 3, name: place.name, item: canonical },
      ] },
    ] } };
}
