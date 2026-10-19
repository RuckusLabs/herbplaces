const TILE_SIZE = 512;
const worldPoint = (longitude, latitude) => {
  const lat = Math.max(-85, Math.min(85, Number(latitude))) * Math.PI / 180;
  return [(Number(longitude) + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2];
};

// Fit the real directory locations into the space beside the introduction.
export function getHeroMapLayout(places, width, height, mobile = false) {
  const valid = places.filter(place => place.longitude !== null && place.latitude !== null && place.longitude !== '' && place.latitude !== '' && Number.isFinite(Number(place.longitude)) && Number.isFinite(Number(place.latitude)) && Math.abs(Number(place.longitude)) <= 180 && Math.abs(Number(place.latitude)) <= 85);
  const points = valid.map(place => ({ place, point: worldPoint(place.longitude, place.latitude) }));
  const extent = points.length ? points.map(item => item.point) : [worldPoint(-116.3, 34.1), worldPoint(-97.7, 30.2)];
  const xs = extent.map(point => point[0]);
  const ys = extent.map(point => point[1]);
  const west = Math.min(...xs), east = Math.max(...xs), north = Math.min(...ys), south = Math.max(...ys);
  const left = mobile ? 70 : width * .48;
  const right = mobile ? 70 : 90;
  const top = mobile ? 72 : 125;
  const bottom = mobile ? 85 : 375;
  const zoom = Math.min(7, Math.max(1, Math.log2(Math.min(Math.max(80, width - left - right) / Math.max((east - west) * TILE_SIZE, 1), Math.max(80, height - top - bottom) / Math.max((south - north) * TILE_SIZE, 1)))));
  const scale = TILE_SIZE * 2 ** zoom;
  const center = [(west + east) / 2 - (left - right) / (2 * scale), (north + south) / 2 - (top - bottom) / (2 * scale)];
  const longitude = center[0] * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * center[1]))) * 180 / Math.PI;
  const groups = [];
  points.sort((a, b) => Number(Boolean(b.place.isVerified || b.place.isFeatured)) - Number(Boolean(a.place.isVerified || a.place.isFeatured)) || String(a.place.id).localeCompare(String(b.place.id))).forEach(({ place, point }) => {
    const x = width / 2 + (point[0] - center[0]) * scale;
    const y = height / 2 + (point[1] - center[1]) * scale;
    const nearby = groups.find(group => Math.hypot(group.x - x, group.y - y) < (mobile ? 80 : 90));
    if (nearby) nearby.places.push(place);
    else groups.push({ x, y, places: [place] });
  });
  return { longitude, latitude, zoom, groups };
}

// Share static-image URLs across nearby viewport sizes, leaving image caching to
// Mapbox's HTTP headers. Project pins into the exact camera returned by its API.
export function getHeroMapView(places, width, height, mobile = false) {
  const canvasWidth = Math.max(128, Math.round(width / 128) * 128);
  const canvasHeight = Math.max(128, Math.round(height / 32) * 32);
  const layout = getHeroMapLayout(places, canvasWidth, canvasHeight, mobile);
  const cameraScale = Math.min(1, 1280 / canvasWidth, 1280 / canvasHeight);
  const imageWidth = Math.round(canvasWidth * cameraScale);
  const imageHeight = Math.round(canvasHeight * cameraScale);
  const longitude = Number(layout.longitude.toFixed(6));
  const latitude = Number(layout.latitude.toFixed(6));
  const zoom = Number((layout.zoom + Math.log2(cameraScale)).toFixed(2));
  const center = worldPoint(longitude, latitude);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    longitude, latitude, zoom, imageWidth, imageHeight,
    groups: layout.groups.map(group => {
      const point = worldPoint(group.places[0].longitude, group.places[0].latitude);
      return {
        ...group,
        x: (imageWidth / 2 + (point[0] - center[0]) * scale) * width / imageWidth,
        y: (imageHeight / 2 + (point[1] - center[1]) * scale) * height / imageHeight,
      };
    }),
  };
}
