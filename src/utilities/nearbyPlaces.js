export const NEARBY_RADIUS_MILES = 50;

export function getNearbyLocation(params) {
  const latitude = params.get('lat');
  const longitude = params.get('lng');
  if (!latitude?.trim() || !longitude?.trim()) return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng } : null;
}

export function filterNearbyPlaces(places, location) {
  if (!location) return places;
  const radians = degrees => Number(degrees) * Math.PI / 180;
  return places.filter(place => {
    if ([place.latitude, place.longitude].some(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)))
      || Math.abs(Number(place.latitude)) > 90 || Math.abs(Number(place.longitude)) > 180) return false;
    const latitudeDelta = radians(place.latitude - location.latitude);
    const longitudeDelta = radians(place.longitude - location.longitude);
    const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(location.latitude)) * Math.cos(radians(place.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) <= NEARBY_RADIUS_MILES;
  });
}
