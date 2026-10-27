// Researched editorial additions. Preview by default; --apply publishes only
// new profiles, with immutable photo uploads and a private pre-insert backup.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { placeSlug } from '../src/utilities/placeContent.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'supabase/seeds/national-20261027');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const research = fs.readdirSync(directory).filter(file => /^research-.*\.json$/.test(file))
  .flatMap(file => read(path.join(directory, file))).sort((a, b) => a.inputIndex - b.inputIndex);
const input = read(path.join(directory, 'input.json'));
assert.equal(research.length, input.length, 'Every supplied place must have a research outcome.');
assert.equal(new Set(research.map(row => row.inputIndex)).size, input.length);
const geocodes = read(path.join(directory, 'geocodes.json'));
const env = loadEnv('development', root, 'VITE_');
const projectRef = 'qtpepsebztlremlhpxdt';
const seedId = 'national-20261027';
const url = env.VITE_SUPABASE_URL;
assert.equal(new URL(url).hostname, `${projectRef}.supabase.co`);
const apply = process.argv.includes('--apply');
const followup = process.argv.includes('--followup');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const photos = [];
const ready = research.filter(row => row.status === 'ready');
const rows = ready.map(place => {
  const urlSlug = placeSlug(place.name);
  for (const field of ['name', 'address', 'city', 'state', 'zip', 'tagline', 'description']) {
    assert.ok(typeof place[field] === 'string' && place[field].trim(), `Missing ${field}: ${place.name}`);
  }
  assert.ok(place.sources?.length);
  if (place.website) assert.equal(new URL(place.website).protocol, 'https:');
  assert.ok(place.category_ids?.length && place.category_ids.every(id => ['shops', 'herbalists', 'gardens', 'workshops'].includes(id)));
  assert.ok(place.photoCandidates?.length || place.photoUnavailableReason, `Missing photo or documented search outcome: ${place.name}`);
  const photo_alt = {};
  const photoUrls = place.photoCandidates.map(photo => {
    assert.ok(photo.localFile && photo.alt && photo.sourcePage && photo.url, `Missing photo provenance: ${place.name}`);
    const file = path.resolve(root, photo.localFile);
    assert.ok(file.startsWith(path.join(root, 'docs/listing-images/national-20261027/')), 'Photo outside editorial directory.');
    const bytes = fs.readFileSync(file);
    const sha256 = hash(bytes);
    assert.equal(sha256, photo.sha256, `Photo changed: ${file}`);
    assert.ok(bytes.length < 10 * 1024 * 1024 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    assert.ok(photo.width >= 300 && photo.height >= 200, `Photo too small: ${place.name}`);
    const storagePath = `editorial/${seedId}/${urlSlug}/${sha256.slice(0, 16)}.webp`;
    const photoUrl = `${url}/storage/v1/object/public/place-photos/${storagePath}`;
    photos.push({ slug: urlSlug, storagePath, photoUrl, bytes, sha256 });
    photo_alt[photoUrl] = photo.alt;
    return photoUrl;
  });
  const location = geocodes[String(place.inputIndex)];
  // Census sometimes returns numeric/spelled street aliases for the exact same
  // address and coordinates. Preserve the raw evidence while coalescing those.
  const matches = [...new Map((location?.matches || []).map(item =>
    [JSON.stringify([item.coordinates, item.addressComponents.state, item.addressComponents.zip]), item])).values()];
  const match = matches.length === 1 ? matches[0] : null;
  const supplied = input[place.inputIndex];
  const stateCode = place.state_code || supplied.state_code;
  const confirmed = match && match.addressComponents.state === stateCode && match.addressComponents.zip === place.zip;
  if (confirmed) assert.ok(match.coordinates.y > 18 && match.coordinates.y < 72 && match.coordinates.x < -60 && match.coordinates.x > -180);
  return {
    ...Object.fromEntries(['name', 'website', 'address', 'city', 'state', 'zip', 'phone', 'hours', 'tagline', 'description'].map(field => [field, place[field] || ''])),
    urlSlug, type: 'place', category_ids: place.category_ids, social_links: [],
    photos: photoUrls, coverPhoto: photoUrls[0] || '', photo_alt,
    latitude: confirmed ? match.coordinates.y : null,
    longitude: confirmed ? match.coordinates.x : null,
    geocode_status: confirmed ? 'confirmed' : 'review',
    isFeatured: false, isVerified: false,
  };
});
assert.equal(new Set(rows.map(row => row.urlSlug)).size, rows.length, 'Duplicate proposed slug.');
let keyResponse;
try {
  keyResponse = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', projectRef, '--reveal', '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: root }));
} catch { throw new Error('Unable to read credentials from the configured Supabase CLI session.'); }
const keys = Array.isArray(keyResponse) ? keyResponse : keyResponse.api_keys || keyResponse.keys || keyResponse.data || [];
const key = keys.find(item => item.name === 'service_role')?.api_key;
assert.ok(key, 'No server credential available.');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(45000) }),
} };
const db = createClient(url, key, options);
const anonymous = createClient(url, env.VITE_SUPABASE_ANON_KEY, options);
async function value(request) {
  const response = await request;
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
const before = await value(db.from('places').select('*').order('id'));
const bySlug = new Map(before.map(row => [row.urlSlug, row]));
for (const row of rows) {
  const existing = bySlug.get(row.urlSlug);
  if (existing) assert.equal(normalize(existing.name), normalize(row.name), `Slug collision: ${row.name}`);
  assert.ok(!before.some(other => other.urlSlug !== row.urlSlug && normalize(other.city) === normalize(row.city) &&
    (normalize(other.name) === normalize(row.name) || normalize(other.address) === normalize(row.address))), `Possible existing profile: ${row.name}`);
}
const pending = rows.filter(row => !bySlug.has(row.urlSlug));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', supplied: research.length, existingListings: before.length,
  newListings: pending.map(row => row.name), alreadyPresent: research.filter(row => row.status === 'duplicate').map(row => row.name),
  held: research.filter(row => ['closed', 'hold'].includes(row.status)).map(({ name, status, reason }) => ({ name, status, reason })),
  photos: photos.length, mapReview: rows.filter(row => row.geocode_status !== 'confirmed').map(row => row.name),
  missingPhotos: ready.filter(row => !row.photoCandidates?.length).map(row => row.name),
}, null, 2));
if (!apply) process.exit(0);
assert.equal((await value(db.storage.getBucket('place-photos'))).public, true);
const backupDir = path.join(root, 'supabase/.temp/backups');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, `before-${seedId}-${Date.now()}.json`), JSON.stringify({
  savedAt: new Date().toISOString(), projectRef, places: before,
}, null, 2), { flag: 'wx', mode: 0o600 });
for (const row of pending) {
  for (const photo of photos.filter(item => item.slug === row.urlSlug)) {
    const upload = await db.storage.from('place-photos').upload(photo.storagePath, photo.bytes,
      { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (upload.error && !['409', 'Duplicate'].includes(String(upload.error.statusCode)) && !/already exists|duplicate/i.test(upload.error.message)) {
      throw new Error(`Photo upload failed: ${row.name}: ${upload.error.message}`);
    }
    const response = await fetch(photo.photoUrl, { signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 200, `Photo unavailable: ${row.name}`);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), photo.sha256, `Stored image differs: ${row.name}`);
  }
  console.log(`Photo delivery verified: ${row.name}`);
}
// A single insert publishes this batch atomically. No existing profile edits.
if (pending.length) await value(db.from('places').insert(pending).select('id,urlSlug'));
const saved = await value(db.from('places').select('*').in('urlSlug', rows.map(row => row.urlSlug)));
assert.equal(saved.length, rows.length);
const uploads = saved.flatMap(place => photos.filter(photo => photo.slug === place.urlSlug && place.photos.includes(photo.photoUrl))
  .map(photo => ({ path: photo.storagePath, place_id: place.id, url: photo.photoUrl, created_by: null })));
if (uploads.length) await value(db.from('place_uploads').upsert(uploads, { onConflict: 'path', ignoreDuplicates: true }));
const publicRows = await value(anonymous.from('public_places').select('*').in('urlSlug', rows.map(row => row.urlSlug)));
assert.equal(publicRows.length, rows.length, 'All new profiles must be anonymously readable.');
for (const expected of pending) {
  const actual = publicRows.find(row => row.urlSlug === expected.urlSlug);
  for (const [field, content] of Object.entries(expected)) assert.deepEqual(actual[field], content, `Public content differs: ${expected.name}: ${field}`);
}
const after = await value(db.from('places').select('*').order('id'));
assert.equal(after.length, before.length + pending.length);
for (const original of before) assert.deepEqual(after.find(row => row.id === original.id), original, `Existing listing changed: ${original.name}`);
const receipt = { seedId, projectRef, seededAt: new Date().toISOString(), inserted: pending.length, totalListings: after.length,
  photos: publicRows.reduce((total, place) => total + (place.photos?.length || 0), 0),
  photosAdded: photos.filter(photo => pending.some(place => place.urlSlug === photo.slug)).length,
  photoStorageRegistrations: uploads.length, unchangedExisting: before.length,
  missingPhotos: ready.filter(row => !row.photoCandidates?.length).map(({ name, photoUnavailableReason }) => ({ name, reason: photoUnavailableReason })),
  places: publicRows.map(({ id, name, urlSlug, geocode_status }) => ({ id, name, urlSlug, geocode_status, listingUrl: `https://littleherbplaces.com/place/${urlSlug}` })),
  held: research.filter(row => ['hold', 'closed'].includes(row.status)).map(({ inputIndex, name, status, reason, sources }) => ({ inputIndex, name, status, reason, sources })),
  duplicates: research.filter(row => row.status === 'duplicate').map(({ inputIndex, name }) => ({ inputIndex, name })),
  checks: ['All new profiles anonymously readable with matching content', 'Every uploaded image publicly delivered with matching checksum',
    'All pre-existing records unchanged', 'No Featured or Verified badge assigned'],
};
// Preserve the original publication receipt when adding second-pass records.
const receiptFile = path.join(directory, followup ? 'second-pass-receipt.json' : 'receipt.json');
if (!fs.existsSync(receiptFile) || pending.length) fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Complete: ${pending.length} added; ${after.length} total; ${photos.filter(photo => pending.some(place => place.urlSlug === photo.slug)).length} new photos delivered and verified.`);
