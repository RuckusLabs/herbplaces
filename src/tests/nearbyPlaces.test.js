import test from 'node:test';
import assert from 'node:assert/strict';
import { filterNearbyPlaces, getNearbyLocation } from '../utilities/nearbyPlaces.js';

test('location filters require a complete, finite pair of coordinates', () => {
  assert.deepEqual(getNearbyLocation(new URLSearchParams('lat=39.7&lng=-104.9')), { latitude: 39.7, longitude: -104.9 });
  assert.deepEqual(getNearbyLocation(new URLSearchParams('lat=0&lng=0')), { latitude: 0, longitude: 0 });
  for (const query of ['', 'lat=39.7', 'lat=&lng=0', 'lat=91&lng=0', 'lat=0&lng=-181', 'lat=NaN&lng=0', 'lat=Infinity&lng=0']) assert.equal(getNearbyLocation(new URLSearchParams(query)), null);
});

test('nearby discovery excludes distant places and missing coordinates', () => {
  const places = [
    { id: 'denver', latitude: 39.7, longitude: -104.9 },
    { id: 'boulder', latitude: '40.015', longitude: '-105.27' },
    { id: 'springs', latitude: 38.83, longitude: -104.82 },
    { id: 'missing', latitude: null, longitude: null },
    { id: 'invalid', latitude: 91, longitude: 0 },
  ];
  assert.deepEqual(filterNearbyPlaces(places, { latitude: 39.7, longitude: -104.9 }).map(place => place.id), ['denver', 'boulder']);
  assert.equal(filterNearbyPlaces(places, null), places);
  assert.deepEqual(filterNearbyPlaces(places, { latitude: 0, longitude: 0 }), []);
});

test('nearby discovery works across the date line', () => {
  assert.equal(filterNearbyPlaces([{ latitude: 0, longitude: -179.9 }], { latitude: 0, longitude: 179.9 }).length, 1);
});
