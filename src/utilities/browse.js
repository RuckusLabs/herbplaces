import { categories, getPlaceCategories } from './placeFilters.js';

export const BROWSE_PAGE_SIZE = 24;
export const MIN_LOCAL_PLACES = 3;
const slug = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming';
const stateNames = Object.fromEntries(states.split('|').map(pair => pair.split(':')));
const regionName = value => stateNames[String(value || '').trim().toUpperCase()] || String(value || '').trim();
const categorySlugs = { shops: 'herb-shops', herbalists: 'herbalists', gardens: 'gardens', workshops: 'classes' };
export const browsePagePath = page => page <= 1 ? '/browse' : `/browse/page/${page}`;

export function getLocalCollections(places) {
  const cities = new Map();
  for (const place of places) {
    if (!place.city?.trim() || !place.state?.trim()) continue;
    const region = regionName(place.state);
    const path = `/browse/${slug(region)}/${slug(place.city)}`;
    if (!cities.has(path)) cities.set(path, { path, city: place.city.trim(), region, places: [] });
    cities.get(path).places.push(place);
  }
  return [...cities.values()].filter(group => group.places.length >= MIN_LOCAL_PLACES)
    .sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city))
    .flatMap(group => {
      const base = { ...group, heading: `Herb shops, herbalists & gardens in ${group.city}, ${group.region}`,
        description: `Explore ${group.places.length} independent plant-focused places in ${group.city}, ${group.region}. Compare specialties, photos, and visit details, then contact each business directly.` };
      return [base, ...categories.flatMap(category => {
        const selected = group.places.filter(place => getPlaceCategories(place).some(item => item.id === category.id));
        return selected.length < MIN_LOCAL_PLACES ? [] : [{ ...group, path: `${group.path}/${categorySlugs[category.id]}`, category: category.id, places: selected,
          heading: `${category.name} in ${group.city}, ${group.region}`,
          description: `Discover ${selected.length} ${category.name.toLowerCase()} in ${group.city}, ${group.region}. Find business stories, contact details, and information to plan your visit.` }];
      })];
    });
}

export function getBrowsePages(places) {
  const sorted = [...places].sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
  const count = Math.max(1, Math.ceil(sorted.length / BROWSE_PAGE_SIZE));
  const collections = getLocalCollections(places);
  return [...Array.from({ length: count }, (_, index) => ({ path: browsePagePath(index + 1), page: index + 1, pageCount: count,
    heading: index ? `Browse all herb places · page ${index + 1}` : 'Find herb shops, herbalists & gardens by city',
    description: 'Browse independent herb shops, apothecaries, herbalists, gardens, and classes. Explore local collections or discover every place in the directory.',
    places: sorted.slice(index * BROWSE_PAGE_SIZE, (index + 1) * BROWSE_PAGE_SIZE), collections: index ? [] : collections.filter(item => !item.category) })),
  ...collections.map(collection => ({ ...collection, collections: collections.filter(item => item.path !== collection.path && item.city === collection.city && item.region === collection.region) }))];
}
