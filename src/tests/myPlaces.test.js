import test from 'node:test';
import assert from 'node:assert/strict';
import { getMyPlacesView } from '../utilities/myPlaces.js';
const membership = { place_id: '1', place: { urlSlug: 'fern' } };

test('ownership replaces approved requests and claims without hiding another branch', () => {
  const result = getMyPlacesView([membership], [
    { id: 'approved', status: 'approved', place_id: '1', urlSlug: 'fern' },
    { id: 'redundant', status: 'pending', place_id: '1', urlSlug: 'fern' },
  ], [
    { id: 'owned', status: 'listed', place_slug: 'fern' },
    { id: 'other', status: 'pending', name: 'Fern', address: 'Another branch' },
  ]);
  assert.deepEqual(result.activeRequests.map(item => item.id), ['other']);
  assert.deepEqual(result.pendingClaims, []);
  assert.deepEqual(result.pastClaims, []);
});

test('a listed place still needs a next step until ownership is pending or approved', () => {
  const requests = [{ id: 'ready', status: 'listed', place_slug: 'fern' }];
  assert.equal(getMyPlacesView([], [], requests).activeRequests.length, 1);
  const pending = { id: 'pending', status: 'pending', place_id: '1', urlSlug: 'fern' };
  const rejected = { ...pending, id: 'rejected', status: 'rejected', review_note: 'Try again' };
  const result = getMyPlacesView([], [pending, rejected], requests);
  assert.deepEqual(result.pendingClaims, [pending]);
  assert.deepEqual(result.activeRequests, []);
  assert.deepEqual(result.pastClaims, []);
});

test('earlier decisions remain history with review notes and revoked access is not called current ownership', () => {
  const rejected = { status: 'rejected', place_id: '1', review_note: 'Send updated evidence' };
  const oldApproval = { status: 'approved', place_id: '2' };
  const declined = { status: 'declined', review_note: 'More details needed' };
  const result = getMyPlacesView([], [rejected, oldApproval], [declined]);
  assert.deepEqual(result.pendingClaims, []);
  assert.deepEqual(result.activeRequests, []);
  assert.deepEqual(result.pastClaims, [rejected, oldApproval]);
  assert.deepEqual(result.pastRequests, [declined]);
});
