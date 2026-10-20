import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapPlaces, getMapBounds, getPlacesInBounds, createPlaceIndex } from '../utilities/mapPlaces.js';
import { readMapBounds } from '../utilities/mapBounds.js';

const places = [{ id: 'a', longitude: -97.74, latitude: 30.26 }, { id: 'b', longitude: '-97.741', latitude: '30.261' }, { id: 'c', longitude: -116, latitude: 34 }];
test('shared map areas require four ordered coordinates within map limits', () => {
  assert.deepEqual(readMapBounds('-105,39,-104,40'), [[-105, 39], [-104, 40]]);
  assert.deepEqual(readMapBounds('0,0,0,0'), [[0, 0], [0, 0]]);
  for (const value of [null, '', '0,,0,1', '0,0,1', '1,0,0,1', '0,2,1,1', '-181,0,0,1', '0,0,181,1', '0,-90,1,1', '0,0,1,90', '0,0,NaN,1']) assert.equal(readMapBounds(value), null);
});
test('only usable map locations enter bounds and clustering', () => {
  assert.deepEqual(getMapPlaces([...places, ...[null, undefined, '', 'bad', 181].map(longitude => ({ longitude, latitude: 30 })), { longitude: 20, latitude: 90 }]), places);
  assert.deepEqual(getMapBounds(places), [[-116, 30.26], [-97.74, 34]]);
  assert.equal(getMapBounds([]), null);
});
test('area searches include boundary places and preserve all results until requested', () => {
  assert.equal(getPlacesInBounds(places, null), places);
  assert.deepEqual(getPlacesInBounds(places, [-98, 30, -97, 31]).map(p => p.id), ['a', 'b']);
  assert.deepEqual(getPlacesInBounds(places, [-116, 34, -116, 34]).map(p => p.id), ['c']);
  assert.deepEqual(getPlacesInBounds(places, [0, 0, 1, 1]), []);
});
test('area searches handle bounds crossing the date line', () => {
  const items = [{ longitude: 179, latitude: 0 }, { longitude: -179, latitude: 0 }, { longitude: 0, latitude: 0 }];
  assert.equal(getPlacesInBounds(items, [170, -10, -170, 10]).length, 2);
});
test('nearby pins cluster with counts and expand to distinct places', () => {
  const index = createPlaceIndex(places);
  const world = [-180, -85, 180, 85];
  const cluster = index.getClusters(world, 5).find(feature => feature.properties.cluster);
  assert.equal(cluster.properties.point_count, 2);
  const zoom = index.getClusterExpansionZoom(cluster.properties.cluster_id);
  assert.ok(zoom > 5);
  assert.deepEqual(index.getLeaves(cluster.properties.cluster_id, Infinity).map(f => f.properties.placeId).sort(), ['a', 'b']);
  assert.equal(index.getClusters(world, zoom).length, 3);
});
test('filtering the cluster index removes stale pins, including empty results', () => {
  const world = [-180, -85, 180, 85];
  assert.equal(createPlaceIndex([]).getClusters(world, 4).length, 0);
  assert.equal(createPlaceIndex([places[2]]).getClusters(world, 4)[0].properties.placeId, 'c');
});
