import test from 'node:test';
import assert from 'node:assert/strict';
import { getHeroMapLayout } from '../utilities/heroMap.js';

const places = [
  { id: 1, longitude: -116.31, latitude: 34.14 },
  { id: 2, longitude: -110.97, latitude: 32.23 },
  { id: 3, longitude: -97.77, latitude: 30.25, isVerified: true },
  { id: 4, longitude: -97.71, latitude: 30.26 },
];

test('hero pins use real coordinates, keep the introduction clear, and group nearby places', () => {
  const layout = getHeroMapLayout(places, 1440, 670);
  assert.equal(layout.groups.length, 3);
  assert.equal(layout.groups[0].places[0].id, 3);
  assert.deepEqual(layout.groups[0].places.map(place => place.id), [3, 4]);
  for (const group of layout.groups) {
    assert.ok(group.x >= 1440 * .48 - 1 && group.x <= 1351);
    assert.ok(group.y >= 124 && group.y <= 426);
  }
});

test('mobile pins remain inside the map and every valid listing belongs to one group', () => {
  const layout = getHeroMapLayout(places, 375, 325, true);
  assert.deepEqual(layout.groups.flatMap(group => group.places.map(place => place.id)).sort(), [1, 2, 3, 4]);
  for (const group of layout.groups) assert.ok(group.x >= 54 && group.x <= 321 && group.y >= 71 && group.y <= 241);
});

test('missing and invalid locations are omitted; an empty map still has a finite camera', () => {
  const layout = getHeroMapLayout([{ id: 1, latitude: null, longitude: null }, { id: 2, latitude: 32, longitude: 250 }, { id: 3, latitude: 'bad', longitude: -110 }], 1200, 670);
  assert.deepEqual(layout.groups, []);
  assert.ok([layout.longitude, layout.latitude, layout.zoom].every(Number.isFinite));
});
