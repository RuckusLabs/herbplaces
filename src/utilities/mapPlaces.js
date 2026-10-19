import Supercluster from 'supercluster';

export function getMapPlaces(places) {
  return places.filter(place => [place.longitude, place.latitude].every(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) && Math.abs(Number(place.longitude)) <= 180 && Math.abs(Number(place.latitude)) <= 85.051129);
}
export function getMapBounds(places) {
  if (!places.length) return null;
  const lng = places.map(place => Number(place.longitude));
  const lat = places.map(place => Number(place.latitude));
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
}
export function getPlacesInBounds(places, bounds) {
  if (!bounds) return places;
  const [west, south, east, north] = bounds;
  return places.filter(place => {
    const lng = Number(place.longitude);
    const lat = Number(place.latitude);
    return lat >= south && lat <= north && (west <= east ? lng >= west && lng <= east : lng >= west || lng <= east);
  });
}
export function createPlaceIndex(places) {
  return new Supercluster({ radius: 55, maxZoom: 16 }).load(places.map(place => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(place.longitude), Number(place.latitude)] }, properties: { placeId: String(place.id) } })));
}
