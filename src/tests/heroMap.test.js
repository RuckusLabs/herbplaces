import test from 'node:test';
import assert from 'node:assert/strict';
import { getHeroMapLayout, getHeroMapView } from '../utilities/heroMap.js';

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

test('nearby viewport sizes share the same static image while pins scale with the display', () => {
  const first = getHeroMapView(places, 390, 325, true);
  const resized = getHeroMapView(places, 395, 326, true);
  const { groups: firstGroups, ...firstRequest } = first;
  const { groups: resizedGroups, ...resizedRequest } = resized;
  assert.deepEqual(firstRequest, resizedRequest);
  firstGroups.forEach((group, i) => {
    assert.deepEqual(group.places, resizedGroups[i].places);
    assert.ok(Math.abs(group.x / 390 - resizedGroups[i].x / 395) < 1e-10);
    assert.ok(Math.abs(group.y / 325 - resizedGroups[i].y / 326) < 1e-10);
  });
});

test('pins match the static image camera at phone, desktop, and large desktop sizes', () => {
  for (const [width, height, mobile] of [[320, 325, true], [760, 325, true], [1280, 670, false], [1440, 670, false], [3840, 670, false]]) {
    const view = getHeroMapView(places, width, height, mobile);
    assert.ok(view.imageWidth >= 1 && view.imageWidth <= 1280);
    assert.ok(view.imageHeight >= 1 && view.imageHeight <= 1280);
    assert.ok([view.longitude, view.latitude, view.zoom].every(Number.isFinite));
    // Unproject the rendered pin back to a longitude/latitude in the API image.
    const centerY = (1 - Math.log(Math.tan(Math.PI / 4 + view.latitude * Math.PI / 360)) / Math.PI) / 2;
    const scale = 512 * 2 ** view.zoom;
    for (const group of view.groups) {
      const longitude = view.longitude + (group.x / width - .5) * view.imageWidth / scale * 360;
      const y = centerY + (group.y / height - .5) * view.imageHeight / scale;
      const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
      assert.ok(Math.abs(longitude - group.places[0].longitude) < 1e-8);
      assert.ok(Math.abs(latitude - group.places[0].latitude) < 1e-8);
      assert.ok(group.x >= 0 && group.x <= width);
      assert.ok(group.y >= 0 && group.y <= height);
    }
  }
});
