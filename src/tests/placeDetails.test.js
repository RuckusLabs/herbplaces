import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlacePhotos, getWebsiteUrl } from '../utilities/placeDetails.js';

test('photos preserve their order while excluding invalid entries and duplicates', () => {
  assert.deepEqual(getPlacePhotos({ photos: ['one.jpg', null, 'two.jpg', '', 'one.jpg'] }), ['one.jpg', 'two.jpg']);
});
test('a cover photo is shown when a gallery is missing or empty', () => {
  assert.deepEqual(getPlacePhotos({ coverPhoto: 'cover.jpg' }), ['cover.jpg']);
  assert.deepEqual(getPlacePhotos({ photos: [], coverPhoto: 'cover.jpg' }), ['cover.jpg']);
  assert.deepEqual(getPlacePhotos(null), ['/assets/pages/home/hero.jpg']);
});
test('website links accept existing HTTP URLs and normalize bare domains', () => {
  assert.equal(getWebsiteUrl('https://example.com/shop'), 'https://example.com/shop');
  assert.equal(getWebsiteUrl('www.example.com'), 'https://www.example.com/');
  assert.equal(getWebsiteUrl(' http://example.com '), 'http://example.com/');
});
test('invalid and non-web website links are excluded', () => {
  for (const value of [undefined, '', 'not a URL', 'javascript:alert(1)', 'data:text/html,example', 'mailto:test@example.com']) assert.equal(getWebsiteUrl(value), null);
});
