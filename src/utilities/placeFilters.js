export const categories = [
  { id: 'shops', name: 'Herb Shops & Apothecaries', short: 'Herb Shops', icon: 'shop', description: 'Shelves full of plants. People full of wisdom.', terms: ['shop', 'apothecar', 'store', 'mercantile', 'herb bar'] },
  { id: 'herbalists', name: 'Herbalists & Makers', short: 'Herbalists', icon: 'craft', description: 'Meet the people keeping plant traditions alive.', terms: ['herbalist', 'maker', 'practitioner', 'clinic'] },
  { id: 'gardens', name: 'Gardens & Growers', short: 'Gardens', icon: 'garden', description: 'A little closer to where it all begins.', terms: ['garden', 'grower', 'farm', 'nursery'] },
  { id: 'workshops', name: 'Classes & Gatherings', short: 'Classes', icon: 'group', description: 'Learn something new. Find your people.', terms: ['class', 'workshop', 'gathering', 'school', 'education'] },
];
function getSearchText(place) {
  return [place.name, place.city, place.state, place.address, place.tagline, place.description, place.category, place.type, ...(Array.isArray(place.categories) ? place.categories : []), ...categories.filter(category => place.category_ids?.includes(category.id)).map(category => category.name)].filter(Boolean).join(' ').toLowerCase();
}

export function getPlaceCategories(place) {
  if (Array.isArray(place.category_ids)) return categories.filter(category => place.category_ids.includes(category.id));
  const text = getSearchText(place);
  return categories.filter(category => category.terms.some(term => text.includes(term)));
}

export function filterPlaces(places, query = '', category = '') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const selected = categories.find(item => item.id === category);
  return places.filter(place => {
    const text = getSearchText(place);
    return words.every(word => text.includes(word)) && (!selected || getPlaceCategories(place).some(category => category.id === selected.id));
  });
}
