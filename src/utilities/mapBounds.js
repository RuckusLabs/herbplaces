export function getMapBounds(places) {
  if (!places.length) return null;
  const lng = places.map(place => Number(place.longitude));
  const lat = places.map(place => Number(place.latitude));
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
}

export function readMapBounds(value) {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 4 || parts.some(part => !part.trim())) return null;
  const [west, south, east, north] = parts.map(Number);
  if (![west, south, east, north].every(Number.isFinite) || west < -180 || east > 180 || west > east
    || south < -85.051129 || north > 85.051129 || south > north) return null;
  return [[west, south], [east, north]];
}
