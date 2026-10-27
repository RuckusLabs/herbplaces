// Editorial follow-up for exactly the three photographed-later profiles.
// Preview by default. Preserve existing photos/cover/content and original receipt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'supabase/seeds/national-20261027');
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const originalReceipt = read('receipt.json');
const evidence = read('second-pass-photos.json');
const allowed = originalReceipt.missingPhotos.map(row => row.name);
assert.equal(evidence.length, allowed.length);
assert.equal(new Set(evidence.map(row => row.name)).size, allowed.length);
assert.ok(evidence.every(row => allowed.includes(row.name)));
const env = loadEnv('development', root, 'VITE_');
const url = env.VITE_SUPABASE_URL;
const projectRef = 'qtpepsebztlremlhpxdt';
assert.equal(new URL(url).hostname, `${projectRef}.supabase.co`);
const apply = process.argv.includes('--apply');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let response;
try {
  response = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', projectRef, '--reveal', '--output', 'json'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch { throw new Error('Unable to use configured Supabase CLI credentials.'); }
const keys = Array.isArray(response) ? response : response.api_keys || response.keys || response.data || [];
const key = keys.find(item => item.name === 'service_role')?.api_key;
assert.ok(key);
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(45000) }),
} };
const db = createClient(url, key, options);
const anonymous = createClient(url, env.VITE_SUPABASE_ANON_KEY, options);
async function value(request) {
  const result = await request;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const before = await value(db.from('places').select('*').order('id'));
const plans = evidence.filter(row => row.photoCandidates?.length).map(row => {
  const identity = originalReceipt.places.find(place => place.name === row.name);
  assert.ok(identity);
  const previous = before.find(place => place.id === identity.id);
  assert.equal(previous?.name, row.name);
  const images = row.photoCandidates.map(photo => {
    const filename = path.resolve(root, photo.localFile);
    assert.ok(filename.startsWith(path.join(root, 'docs/listing-images/national-20261027/')));
    assert.ok(photo.url && photo.sourcePage && photo.alt && photo.width >= 300 && photo.height >= 200);
    const bytes = fs.readFileSync(filename);
    assert.equal(hash(bytes), photo.sha256);
    assert.ok(bytes.length < 10 * 1024 * 1024 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    const storagePath = `editorial/national-20261027-followup/${identity.urlSlug}/${photo.sha256.slice(0, 16)}.webp`;
    return { ...photo, bytes, storagePath, publicUrl: `${url}/storage/v1/object/public/place-photos/${storagePath}` };
  });
  const photos = [...new Set([...(previous.photos || []), ...images.map(photo => photo.publicUrl)])];
  const photo_alt = { ...previous.photo_alt, ...Object.fromEntries(images.map(photo => [photo.publicUrl, photo.alt])) };
  return { previous, images, content: { photos, coverPhoto: previous.coverPhoto || photos[0], photo_alt } };
});
const pending = plans.filter(plan => JSON.stringify(plan.previous.photos) !== JSON.stringify(plan.content.photos));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', newPhotos: pending.reduce((n, plan) => n + plan.images.length, 0),
  profiles: pending.map(plan => plan.previous.name), missing: evidence.filter(row => !row.photoCandidates?.length).map(row => row.name) }, null, 2));
if (!apply) process.exit(0);
const backupDirectory = path.join(root, 'supabase/.temp/backups');
fs.mkdirSync(backupDirectory, { recursive: true });
fs.writeFileSync(path.join(backupDirectory, `before-national-photos-followup-${Date.now()}.json`),
  JSON.stringify({ projectRef, savedAt: new Date().toISOString(), places: before }, null, 2), { mode: 0o600, flag: 'wx' });
for (const plan of pending) {
  for (const photo of plan.images) {
    const upload = await db.storage.from('place-photos').upload(photo.storagePath, photo.bytes,
      { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (upload.error && !['409', 'Duplicate'].includes(String(upload.error.statusCode)) && !/already exists|duplicate/i.test(upload.error.message)) throw new Error(upload.error.message);
    const delivered = await fetch(photo.publicUrl, { signal: AbortSignal.timeout(45000) });
    assert.equal(delivered.status, 200);
    assert.equal(hash(Buffer.from(await delivered.arrayBuffer())), photo.sha256);
  }
  const next = { ...plan.content, content_version: plan.previous.content_version + 1, updated_at: new Date().toISOString() };
  const saved = await value(db.from('places').update(next).eq('id', plan.previous.id).eq('content_version', plan.previous.content_version).select('*').single());
  for (const [field, content] of Object.entries(plan.previous)) {
    if (!Object.hasOwn(next, field)) assert.deepEqual(saved[field], content, `Non-photo field changed: ${field}`);
  }
  for (const [field, content] of Object.entries(plan.content)) assert.deepEqual(saved[field], content);
  await value(db.from('place_uploads').upsert(plan.images.map(photo => ({ path: photo.storagePath, place_id: saved.id, url: photo.publicUrl, created_by: null })),
    { onConflict: 'path', ignoreDuplicates: true }));
  await value(db.from('management_audit').insert({ actor_id: null, action: 'editorial_photo_added', place_id: String(saved.id),
    details: { seedId: 'national-20261027-followup', photos: plan.images.length, previousVersion: plan.previous.content_version, version: saved.content_version } }));
}
const after = await value(db.from('places').select('*').order('id'));
assert.equal(after.length, before.length);
for (const previous of before.filter(row => !pending.some(plan => plan.previous.id === row.id))) assert.deepEqual(after.find(row => row.id === previous.id), previous);
const publiclyListed = await value(anonymous.from('public_places').select('id,name,urlSlug,photos,coverPhoto,photo_alt').in('id', plans.map(plan => plan.previous.id)));
for (const plan of plans) {
  const published = publiclyListed.find(row => row.id === plan.previous.id);
  for (const [field, content] of Object.entries(plan.content)) assert.deepEqual(published?.[field], content, `Public photo mismatch: ${plan.previous.name}`);
}
const receipt = { projectRef, appliedAt: new Date().toISOString(), updated: pending.length, photosAdded: pending.reduce((n, plan) => n + plan.images.length, 0),
  totalListings: after.length, profiles: publiclyListed, missingPhotos: evidence.filter(row => !row.photoCandidates?.length).map(row => row.name),
  checks: ['Photo bytes delivered with matching checksums', 'Existing photo/cover content preserved', 'Version-conditional updates',
    'All non-photo fields unchanged except version/timestamp', 'Other profiles unchanged', 'New public photos/alt text match'] };
const filename = path.join(directory, 'second-pass-photo-receipt.json');
if (!fs.existsSync(filename) || pending.length) fs.writeFileSync(filename, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Verified ${pending.length} profile photo updates; ${after.length} total listings.`);
