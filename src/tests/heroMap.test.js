import test from 'node:test';
import assert from 'node:assert/strict';
import { getHeroMapLayout, getHeroMapGroups } from '../utilities/heroMap.js';

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

test('hero pins match the renderer camera at phone, desktop, and large desktop sizes', () => {
  for (const [width, height, mobile] of [[320, 325, true], [760, 325, true], [1280, 670, false], [1440, 670, false], [3840, 670, false]]) {
    const view = getHeroMapLayout(places, width, height, mobile);
    assert.ok([view.longitude, view.latitude, view.zoom].every(Number.isFinite));
    const centerY = (1 - Math.log(Math.tan(Math.PI / 4 + view.latitude * Math.PI / 360)) / Math.PI) / 2;
    const scale = 512 * 2 ** view.zoom;
    for (const group of view.groups) {
      const longitude = view.longitude + (group.x - width / 2) / scale * 360;
      const y = centerY + (group.y - height / 2) / scale;
      const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
      assert.ok(Math.abs(longitude - group.places[0].longitude) < 1e-8);
      assert.ok(Math.abs(latitude - group.places[0].latitude) < 1e-8);
      assert.ok(group.x >= 0 && group.x <= width);
      assert.ok(group.y >= 0 && group.y <= height);
    }
  }
});


test('zooming separates nearby pins without losing any locations', () => {
  const entries = [{ id: 'a', longitude: -104.9, latitude: 39.7 }, { id: 'b', longitude: -104.8, latitude: 39.7 }];
  assert.equal(getHeroMapGroups(entries, 1200, 670, { longitude: -105, latitude: 40, zoom: 7 }).length, 1);
  const closer = getHeroMapGroups(entries, 1200, 670, { longitude: -105, latitude: 40, zoom: 10 });
  assert.equal(closer.length, 2);
  assert.deepEqual(closer.flatMap(group => group.places.map(place => place.id)), ['a', 'b']);
});
