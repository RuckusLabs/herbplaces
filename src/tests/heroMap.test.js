import test from 'node:test';
import assert from 'node:assert/strict';
import { heroMapDestination, heroMapPlaces } from '../utilities/heroMap.js';
import { createPlaceIndex } from '../utilities/mapPlaces.js';

test('homepage overview includes all usable locations across countries', () => {
  const places = [
    { id: 'la', longitude: -118.38, latitude: 34.07 },
    { id: 'long-beach', longitude: -118.19, latitude: 33.77 },
    { id: 'london', longitude: -.12, latitude: 51.5 },
    { id: 'tokyo', longitude: 139.69, latitude: 35.68 },
    { id: 'sydney', longitude: 151.2, latitude: -33.86 },
    { id: 'cape-town', longitude: 18.42, latitude: -33.92 },
  ];
  const located = heroMapPlaces([...places, { id: 'missing', longitude: null, latitude: null }]);
  assert.equal(located.length, places.length);
  const index = createPlaceIndex(located);
  const world = [-180, -85, 180, 85];
  const groups = index.getClusters(world, 1);
  const ids = groups.flatMap(feature => feature.properties.cluster
    ? index.getLeaves(feature.properties.cluster_id, Infinity).map(leaf => leaf.properties.placeId)
    : [feature.properties.placeId]);
  assert.deepEqual(ids.sort(), places.map(place => place.id).sort());
  assert.ok(groups.length < places.length);
  const cluster = groups.find(feature => feature.properties.cluster);
  assert.ok(index.getClusterExpansionZoom(cluster.properties.cluster_id) > 1);
});

test('Explore This Area preserves supported bounds and safely handles world edges', () => {
  const destination = new URL(heroMapDestination([-119, 32, -115, 35]), 'https://example.com');
  assert.equal(destination.searchParams.get('bounds'), '-119,32,-115,35');
  assert.equal(destination.searchParams.get('view'), 'map');
  for (const bounds of [null, [-200, -85, 200, 85], [170, -30, 190, 30], [170, -30, -170, 30]]) {
    assert.equal(heroMapDestination(bounds), '/map?view=map');
  }
});
