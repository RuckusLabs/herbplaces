import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedPlaces } from '../utilities/relatedPlaces.js';

const place = { id: 1, latitude: 40, longitude: -105, city: 'Denver', state: 'CO', category_ids: ['shops'] };
test('nearby places cross city boundaries and outrank distant places of the same type', () => {
  const places = [place,
    { id: 2, name: 'Far shop', latitude: 39, longitude: -104, category_ids: ['shops'] },
    { id: 3, name: 'Nearby garden', latitude: 40.01, longitude: -105, city: 'Boulder', state: 'CO', category_ids: ['gardens'] },
    { id: 4, name: 'Nearby shop', latitude: 40.02, longitude: -105, category_ids: ['shops'] },
    { id: 5, name: 'Far garden', latitude: 39.4, longitude: -105, category_ids: ['gardens'] },
  ];
  assert.deepEqual(relatedPlaces(place, places, 4).map(p => p.id), [3, 4, 2, 5]);
  assert.equal(places[0], place);
});
test('missing coordinates use city and region, then type, without treating blanks as zero', () => {
  const origin = { ...place, latitude: null, longitude: '' };
  const places = [{ id: 2, name: 'Different region', city: 'Denver', state: 'NC', category_ids: [] },
    { id: 3, name: 'Local garden', city: ' denver ', state: 'co', category_ids: ['gardens'] },
    { id: 4, name: 'Other shop', category_ids: ['shops'] }];
  assert.deepEqual(relatedPlaces(origin, places).map(p => p.id), [3, 4, 2]);
  assert.deepEqual(relatedPlaces(origin, [origin]), []);
});
test('equal distances prioritize shared types and invalid coordinates are ignored', () => {
  const places = [{ id: 2, name: 'Garden', latitude: 40.01, longitude: -105, category_ids: ['gardens'] },
    { id: 3, name: 'Shop', latitude: '40.01', longitude: '-105', category_ids: ['shops'] },
    { id: 4, name: 'Invalid', latitude: 999, longitude: NaN, category_ids: [] }];
  assert.deepEqual(relatedPlaces(place, places).map(p => p.id), [3, 2, 4]);
});
