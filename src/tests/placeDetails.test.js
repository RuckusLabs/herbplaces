import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpeningHours, getPlacePhotos, getWebsiteUrl } from '../utilities/placeDetails.js';

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

test('opening schedules split distinct days while keeping ranges and notes intact', () => {
  assert.deepEqual(getOpeningHours('Monday–Friday: 10am–6pm; Saturday: 11am–5pm. Check the website for holiday hours.'), ['Monday–Friday: 10am–6pm', 'Saturday: 11am–5pm. Check the website for holiday hours.']);
  assert.deepEqual(getOpeningHours('Mon–Fri: 9–5, Sat: 10–4, Sun: closed'), ['Mon–Fri: 9–5', 'Sat: 10–4', 'Sun: closed']);
  assert.deepEqual(getOpeningHours('• Monday: 9–5\n• Tuesday: closed'), ['Monday: 9–5', 'Tuesday: closed']);
  assert.deepEqual(getOpeningHours('Call ahead for seasonal hours.'), ['Call ahead for seasonal hours.']);
  assert.deepEqual(getOpeningHours(''), []);
  assert.deepEqual(getOpeningHours(null), []);
});
