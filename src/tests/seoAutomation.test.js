import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryHash, needsBuild, validatePlaces } from '../../scripts/seo/directory.mjs';

const places = [{ id: 1, urlSlug: 'moss', name: 'Moss', photos: ['a.jpg', 'b.jpg'] }, { id: 2, urlSlug: 'fern', name: 'Fern' }];
test('scheduled builds skip unchanged listings independently of row and object key order', () => {
  const previous = directoryHash(places);
  const reordered = [...places].reverse().map(place => Object.fromEntries(Object.entries(place).reverse()));
  assert.equal(needsBuild(reordered, `${previous}\n`), false);
  assert.equal(needsBuild(places, previous, true), true);
  assert.equal(needsBuild(places), true);
});
test('scheduled builds detect added, removed, edited, and reordered gallery content', () => {
  const previous = directoryHash(places);
  for (const changed of [places.slice(1), [...places, { id: 3, urlSlug: 'ivy', name: 'Ivy' }], [{ ...places[0], name: 'New Moss' }, places[1]], [{ ...places[0], photos: ['b.jpg', 'a.jpg'] }, places[1]]]) {
    assert.equal(needsBuild(changed, previous), true);
  }
});
test('automation refuses empty or invalid snapshots instead of replacing the live export', () => {
  for (const invalid of [[], null, [{ ...places[0], urlSlug: '../admin' }], [places[0], places[0]]]) {
    assert.throws(() => validatePlaces(invalid));
  }
});
