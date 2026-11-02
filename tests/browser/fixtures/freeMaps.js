export const emptyMapStyle = {
  version: 8,
  sources: {
    attribution: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#edf0e6' } },
    { id: 'empty', type: 'circle', source: 'attribution' },
  ],
};

export async function mockFreeMaps(page) {
  await page.route('https://tiles.openfreemap.org/**', route => route.fulfill({ json: emptyMapStyle }));
}
