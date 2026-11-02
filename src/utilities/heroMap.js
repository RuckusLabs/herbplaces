// Keep the homepage and Explore Places on the same coordinate and cluster rules.
export { getMapPlaces as heroMapPlaces } from './mapPlaces.js';

export function heroMapDestination(bounds) {
  if (!bounds || bounds[2] - bounds[0] >= 360) return '/map?view=map';
  const [west, south, east, north] = bounds;
  // The directory supports a single, non-wrapping bounds rectangle.
  if (west < -180 || east > 180 || west > east) return '/map?view=map';
  return `/map?${new URLSearchParams({ view: 'map', bounds: [west, Math.max(-85, south), east, Math.min(85, north)].join(',') })}`;
}
