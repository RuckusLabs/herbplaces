// No account, token, or metered map service is used by this build.
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
export const MAP_LOAD_TIMEOUT_MS = 15000;

// Styles can reference additional tile, sprite, and font URLs. Keep every map
// resource on the free provider; an unexpected host must fail, not incur a bill.
export function freeMapRequest(url) {
  const resource = new URL(url);
  if (resource.protocol !== 'https:' || resource.hostname !== 'tiles.openfreemap.org') {
    throw new Error('This map resource is not hosted by OpenFreeMap.');
  }
  return { url };
}
