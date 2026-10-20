import test from 'node:test';
import assert from 'node:assert/strict';
import { paginatePlaces } from '../utilities/pagination.js';

const items = Array.from({ length: 31 }, (_, index) => index + 1);
test('place pagination caps pages at 15 and keeps every result reachable', () => {
  const first = paginatePlaces(items, '1'), second = paginatePlaces(items, '2'), last = paginatePlaces(items, '3');
  assert.deepEqual([first.items.length, second.items.length, last.items.length], [15, 15, 1]);
  assert.deepEqual([...first.items, ...second.items, ...last.items], items);
  assert.deepEqual([second.start, second.end, second.total, second.pageCount], [16, 30, 31, 3]);
  assert.deepEqual([last.start, last.end], [31, 31]);
});
test('invalid pages fall back safely and requests past the end use the last page', () => {
  for (const value of [null, '', 'bad', '0', '-1', '1.5', 'Infinity', '9007199254740992']) assert.equal(paginatePlaces(items, value).page, 1);
  assert.equal(paginatePlaces(items, '99').page, 3);
  assert.equal(paginatePlaces(items.slice(0, 15), '2').page, 1);
  assert.deepEqual(paginatePlaces([], '9'), { items: [], page: 1, pageCount: 1, total: 0, start: 0, end: 0 });
});
