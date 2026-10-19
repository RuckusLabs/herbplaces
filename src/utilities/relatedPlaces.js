import { getPlaceCategories } from './placeFilters.js';

function coordinates(place) {
  const values = [place.latitude, place.longitude];
  if (values.some(value => value === null || value === undefined || String(value).trim() === '')) return null;
  const [latitude, longitude] = values.map(Number);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? [latitude, longitude] : null;
}

function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const radians = degrees => degrees * Math.PI / 180;
  const h = Math.sin(radians(b[0] - a[0]) / 2) ** 2
    + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(radians(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

const normalized = value => String(value || '').trim().toLowerCase();

export function relatedPlaces(place, places, limit = 3) {
  const origin = coordinates(place);
  const categories = new Set(getPlaceCategories(place).map(category => category.id));
  return places.filter(item => String(item.id) !== String(place.id)).map(item => {
    const distance = distanceKm(origin, coordinates(item));
    const sameCity = normalized(place.city) && normalized(item.city) === normalized(place.city)
      && normalized(item.state) === normalized(place.state);
    // Explore the nearest places within 50 km first. Without map coordinates,
    // a matching city and region is our local fallback; then suggest similar types.
    const nearby = distance <= 50 || (!Number.isFinite(distance) && !!sameCity);
    const sameType = (normalized(place.type) && normalized(item.type) === normalized(place.type))
      || getPlaceCategories(item).some(category => categories.has(category.id));
    return { item, nearby, sameType: !!sameType, distance };
  }).sort((a, b) => Number(b.nearby) - Number(a.nearby)
    || (a.nearby ? a.distance - b.distance : Number(b.sameType) - Number(a.sameType))
    || Number(b.sameType) - Number(a.sameType) || a.distance - b.distance
    || String(a.item.name).localeCompare(String(b.item.name)) || String(a.item.id).localeCompare(String(b.item.id)))
    .slice(0, limit).map(result => result.item);
}
