import { regionName } from './browse.js';

const TILE_SIZE = 512;
const worldPoint = (longitude, latitude) => {
  const lat = Math.max(-85, Math.min(85, Number(latitude))) * Math.PI / 180;
  return [(Number(longitude) + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2];
};

const localDistanceKm = (a,b) => {
  const radians=value=>Number(value)*Math.PI/180;
  const h=Math.sin(radians(b.latitude-a.latitude)/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(radians(b.longitude-a.longitude)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
};
export const heroMapPlaces = places => places.filter(place => place.longitude !== null && place.latitude !== null && String(place.longitude ?? '').trim() !== '' && String(place.latitude ?? '').trim() !== '' && Number.isFinite(Number(place.longitude)) && Number.isFinite(Number(place.latitude)) && Math.abs(Number(place.longitude)) <= 180 && Math.abs(Number(place.latitude)) <= 85);
// Fit the real directory locations into the space beside the introduction.
export function getHeroMapLayout(places, width, height, mobile = false) {
  const valid = heroMapPlaces(places);
  const points = valid.map(place => ({ place, point: worldPoint(place.longitude, place.latitude) }));
  const extent = points.length ? points.map(item => item.point) : [worldPoint(-116.3, 34.1), worldPoint(-97.7, 30.2)];
  const xs = extent.map(point => point[0]);
  const ys = extent.map(point => point[1]);
  const west = Math.min(...xs), east = Math.max(...xs), north = Math.min(...ys), south = Math.max(...ys);
  const left = mobile ? 70 : width * .48;
  const right = mobile ? 70 : 90;
  const top = mobile ? 72 : 125;
  const bottom = mobile ? 85 : 110;
  const zoom = Math.min(7, Math.max(1, Math.log2(Math.min(Math.max(80, width - left - right) / Math.max((east - west) * TILE_SIZE, 1), Math.max(80, height - top - bottom) / Math.max((south - north) * TILE_SIZE, 1)))));
  const scale = TILE_SIZE * 2 ** zoom;
  const center = [(west + east) / 2 - (left - right) / (2 * scale), (north + south) / 2 - (top - bottom) / (2 * scale)];
  const longitude = center[0] * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * center[1]))) * 180 / Math.PI;
  const groups = [];
  points.sort((a, b) => Number(Boolean(b.place.isVerified || b.place.isFeatured)) - Number(Boolean(a.place.isVerified || a.place.isFeatured)) || String(a.place.id).localeCompare(String(b.place.id))).forEach(({ place, point }) => {
    const x = width / 2 + (point[0] - center[0]) * scale;
    const y = height / 2 + (point[1] - center[1]) * scale;
    // Screen proximity alone can hide California/Arizona inside a Texas pin.
    // Keep every cluster within one state and a 120 km local diameter.
    const nearby = groups.find(group => Math.hypot(group.x - x, group.y - y) < (mobile ? 34 : 42) && regionName(group.places[0].state) === regionName(place.state) && group.places.every(member=>localDistanceKm(member,place)<=120));
    if (nearby) nearby.places.push(place);
    else groups.push({ x, y, places: [place] });
  });
  return { longitude, latitude, zoom, groups, count: valid.length };
}
