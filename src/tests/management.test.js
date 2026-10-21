import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinatesFromGeocode, GRACE_MS, hasImageSignature, renewalGraceDeadline, subscriptionAllowsEditing, validatePhotoFile } from '../../supabase/functions/_shared/entitlements.js';
import { createPlaceDraft, placeSlug, preparePlaceContent } from '../utilities/placeContent.js';
import { filterPlaces, getPlaceCategories } from '../utilities/placeFilters.js';
import { createSharedPlaces } from '../utilities/sharedPlaces.js';

test('subscription eligibility observes paid expiry, grace boundaries, cancellation, and pending states', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const future = new Date(now + 1000).toISOString();
  assert.equal(subscriptionAllowsEditing({ status: 'active', paid_until: future, cancel_at_period_end: true }, now), true);
  assert.equal(subscriptionAllowsEditing({ status: 'active', paid_until: new Date(now).toISOString() }, now), false);
  assert.equal(subscriptionAllowsEditing({ status: 'past_due', grace_ends_at: future }, now), true);
  for (const status of ['none','incomplete','incomplete_expired','canceled','unpaid','paused']) assert.equal(subscriptionAllowsEditing({ status, paid_until: future, grace_ends_at: future }, now), false);
  assert.equal(subscriptionAllowsEditing(null, now), false);
  assert.equal(subscriptionAllowsEditing({ status: 'active' }, now), false);
});
test('payment retries never extend an existing seven-day grace window', () => {
  const first = Date.parse('2026-10-19T12:00:00Z');
  const deadline = renewalGraceDeadline(null, first);
  assert.equal(Date.parse(deadline), first + GRACE_MS);
  assert.equal(renewalGraceDeadline(deadline, first + GRACE_MS), deadline);
});
test('photo validation rejects oversized, empty, unsupported, and disguised files', () => {
  assert.throws(() => validatePhotoFile({ type: 'image/svg+xml', size: 100 }));
  assert.throws(() => validatePhotoFile({ type: 'image/png', size: 0 }));
  assert.throws(() => validatePhotoFile({ type: 'image/jpeg', size: 10485761 }));
  validatePhotoFile({ type: 'image/webp', size: 1024 });
  assert.equal(hasImageSignature(new Uint8Array([255,216,255,224]), 'image/jpeg'), true);
  assert.equal(hasImageSignature(new TextEncoder().encode('<script>'), 'image/png'), false);
  assert.equal(hasImageSignature(new TextEncoder().encode('RIFF1234WEBP'), 'image/webp'), true);
});
test('only reliable, finite address matches produce coordinates', () => {
  const result = { features: [{ properties: { feature_type: 'address', match_code: { confidence: 'high' } }, geometry: { coordinates: [-105, 40] } }] };
  assert.deepEqual(coordinatesFromGeocode(result), { longitude: -105, latitude: 40 });
  result.features[0].properties.match_code.confidence = 'medium'; assert.equal(coordinatesFromGeocode(result), null);
  result.features[0].properties.match_code.confidence = 'high'; result.features[0].geometry.coordinates = [999, 40]; assert.equal(coordinatesFromGeocode(result), null);
  assert.equal(coordinatesFromGeocode({ features: [] }), null);
});
test('place drafts isolate edits, preserve photos, normalize URLs, and reject unsafe links', () => {
  const original = { name: 'Moss Apothecary', photos: ['a','b'], coverPhoto: 'a', social_links: [{ label: 'Instagram', url: 'instagram.com/moss' }] };
  const draft = createPlaceDraft(original); draft.photos.reverse(); draft.name = ' Moss '; draft.website = 'example.com';
  const content = preparePlaceContent(draft);
  assert.deepEqual(original.photos, ['a','b']); assert.equal(content.name, 'Moss'); assert.equal(content.website, 'https://example.com/');
  assert.equal(content.social_links[0].url, 'https://instagram.com/moss');
  assert.throws(() => preparePlaceContent({ ...draft, website: 'javascript:alert(1)' }), /valid website/);
  assert.ok(!('id' in content)); assert.ok(!('isVerified' in content));
});
test('explicit categories override keyword inference, including an intentionally empty selection', () => {
  const place = { name: 'Garden Apothecary', description: 'workshops', category_ids: ['herbalists'] };
  assert.deepEqual(getPlaceCategories(place).map(category => category.id), ['herbalists']);
  assert.equal(filterPlaces([place], '', 'gardens').length, 0);
  assert.equal(filterPlaces([place], 'makers', 'herbalists').length, 1);
  assert.equal(getPlaceCategories({ ...place, category_ids: [] }).length, 0);
  assert.ok(getPlaceCategories({ name: 'Garden Apothecary' }).some(category => category.id === 'gardens'));
});

test('shared directory requests deduplicate while publishing reaches every subscriber immediately', async () => {
  let requests = 0;
  const store = createSharedPlaces(async () => { requests++; return [{ id: 1, name: 'Old' }]; });
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  const first = store.refresh(); const second = store.refresh();
  assert.equal(first, second); await first; assert.equal(requests, 1);
  store.publish({ id: 1, name: 'Published' }); assert.equal(store.snapshot().places[0].name, 'Published');
  assert.ok(changes >= 3); unsubscribe();
});

test('an in-flight stale response cannot overwrite a publish and a fresh follow-up is awaited', async () => {
  let resolveOld;
  let requests = 0;
  const store = createSharedPlaces(() => ++requests === 1 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve([{ id: 1, name: 'Published', latitude: 40 }]));
  const pending = store.refresh(); await Promise.resolve();
  store.publish({ id: 1, name: 'Published', latitude: null });
  resolveOld([{ id: 1, name: 'Old' }]);
  await pending;
  assert.equal(requests, 2); assert.equal(store.snapshot().places[0].name, 'Published'); assert.equal(store.snapshot().places[0].latitude, 40);
});

test('a background refresh failure retains the published listing and allows retry', async () => {
  let fail = true;
  const store = createSharedPlaces(async () => { if (fail) throw new Error('Offline'); return [{ id: 1, name: 'Latest' }]; });
  store.publish({ id: 1, name: 'Published' }); await store.refresh();
  assert.equal(store.snapshot().places[0].name, 'Published'); assert.equal(store.snapshot().loading, false); assert.ok(store.snapshot().error);
  fail = false; await store.refresh(); assert.equal(store.snapshot().places[0].name, 'Latest'); assert.equal(store.snapshot().error, '');
});

test('generic links preserve custom text and accept any safe web destination', () => {
  const content = preparePlaceContent(createPlaceDraft({ name: 'Moss', social_links: [{ label: 'Book a consultation', url: 'example.com/book' }] }));
  assert.deepEqual(content.social_links, [{ label: 'Book a consultation', url: 'https://example.com/book' }]);
  assert.throws(() => preparePlaceContent(createPlaceDraft({ name: 'Moss', social_links: [{ label: '', url: 'https://example.com' }] })), /Each link needs text/);
});

test('place names generate readable URL slugs without unsafe or oversized characters', () => {
  assert.equal(placeSlug('  Café & Herb Shop!  '), 'cafe-herb-shop');
  assert.equal(placeSlug('Name -- City'), 'name-city');
  assert.equal(placeSlug(''), '');
  assert.equal(placeSlug('a'.repeat(201)).length, 200);
});

test('renewal processing cannot unlock an unpaid first subscription or extend a scheduled cancellation', () => {
  const now=Date.now();const paid=new Date(now-1000).toISOString();const grace=new Date(now+1000).toISOString();
  assert.equal(subscriptionAllowsEditing({status:'active',paid_until:paid,grace_ends_at:grace},now),true);
  assert.equal(subscriptionAllowsEditing({status:'active',paid_until:null,grace_ends_at:grace},now),false);
  assert.equal(subscriptionAllowsEditing({status:'active',paid_until:paid,grace_ends_at:grace,cancel_at_period_end:true},now),false);
  assert.equal(subscriptionAllowsEditing({status:'active',paid_until:paid,grace_ends_at:paid},now),false);
});
