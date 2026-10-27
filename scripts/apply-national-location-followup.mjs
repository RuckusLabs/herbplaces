// Apply only the five researched location corrections; preview is the default.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'supabase/seeds/national-20261027');
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const evidence = read('third-pass-confirmed-locations.json');
const identities = read('second-pass-receipt.json').places;
assert.deepEqual(evidence.map(row => row.inputIndex).sort((a, b) => a - b), [24, 31, 47, 57, 65]);
const env = loadEnv('development', root, 'VITE_');
const url = env.VITE_SUPABASE_URL;
const projectRef = 'qtpepsebztlremlhpxdt';
assert.equal(new URL(url).hostname, `${projectRef}.supabase.co`);
const apply = process.argv.includes('--apply');
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
const plans = evidence.map(row => {
  assert.ok(row.sources.length >= 2 && row.matchedAddress && row.note);
  assert.ok(row.latitude > 18 && row.latitude < 72 && row.longitude > -180 && row.longitude < -60);
  const identity = identities.find(place => place.name === row.name);
  assert.ok(identity);
  const previous = before.find(place => place.id === identity.id);
  assert.equal(previous?.name, row.name);
  assert.equal(previous.city, row.city);
  const content = { address: row.address, zip: row.zip, latitude: row.latitude, longitude: row.longitude, geocode_status: 'confirmed' };
  return { previous, content, evidence: row };
});
// PostgreSQL may serialize double precision coordinates with fewer decimals.
const equal = (field, actual, expected) => field === 'updated_at' ? Date.parse(actual) === Date.parse(expected) : ['latitude', 'longitude'].includes(field) ? typeof actual === 'number' && Math.abs(actual - expected) < 1e-9 : actual === expected;
const pending = plans.filter(plan => Object.entries(plan.content).some(([key, value]) => !equal(key, plan.previous[key], value)));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', updates: pending.map(plan => ({ name: plan.previous.name, previous: { address: plan.previous.address, zip: plan.previous.zip, geocode_status: plan.previous.geocode_status }, ...plan.content })) }, null, 2));
if (!apply) process.exit(0);
const backupDirectory = path.join(root, 'supabase/.temp/backups');
fs.mkdirSync(backupDirectory, { recursive: true });
fs.writeFileSync(path.join(backupDirectory, `before-national-locations-${Date.now()}.json`), JSON.stringify({ projectRef, savedAt: new Date().toISOString(), places: before }, null, 2), { mode: 0o600, flag: 'wx' });
for (const plan of pending) {
  assert.equal(plan.previous.geocode_status, 'review', 'Refuse to overwrite an independently confirmed location.');
  const next = { ...plan.content, content_version: plan.previous.content_version + 1, updated_at: new Date().toISOString() };
  const saved = await value(db.from('places').update(next).eq('id', plan.previous.id).eq('content_version', plan.previous.content_version).select('*').single());
  for (const [field, content] of Object.entries(plan.previous)) if (!Object.hasOwn(next, field)) assert.deepEqual(saved[field], content, `Unrelated field changed: ${field}`);
  for (const [field, content] of Object.entries(next)) assert.ok(equal(field, saved[field], content), `Saved mismatch: ${field}`);
}
const after = await value(db.from('places').select('*').order('id'));
assert.equal(after.length, before.length);
for (const previous of before.filter(row => !pending.some(plan => plan.previous.id === row.id))) assert.deepEqual(after.find(row => row.id === previous.id), previous);
const publiclyListed = await value(anonymous.from('public_places').select('id,name,urlSlug,address,city,state,zip,latitude,longitude,geocode_status').in('id', plans.map(plan => plan.previous.id)));
for (const plan of plans) for (const [field, content] of Object.entries(plan.content)) assert.ok(equal(field, publiclyListed.find(row => row.id === plan.previous.id)?.[field], content), `Public location mismatch: ${plan.previous.name}`);
// Reconcile audits on retries, including a row committed before a prior verification interrupted.
const audited = await value(db.from('management_audit').select('place_id').eq('action', 'editorial_location_confirmed').contains('details', { seedId: 'national-20261027-third-pass' }));
for (const plan of plans.filter(plan => !audited.some(row => String(row.place_id) === String(plan.previous.id)))) {
  const saved = after.find(row => row.id === plan.previous.id);
  await value(db.from('management_audit').insert({ actor_id: null, action: 'editorial_location_confirmed', place_id: String(saved.id), details: { seedId: 'national-20261027-third-pass', version: saved.content_version, sources: plan.evidence.sources, note: plan.evidence.note } }));
}
const unresolved = after.filter(row => identities.some(identity => identity.id === row.id) && row.geocode_status !== 'confirmed').map(row => row.name);
assert.deepEqual(unresolved, []);
const receipt = { projectRef, appliedAt: new Date().toISOString(), updatedThisInvocation: pending.length, confirmedLocations: publiclyListed.length, totalListings: after.length, profiles: publiclyListed, remainingMapReview: unresolved, checks: ['Exact government address evidence for all five pins', 'Version-conditional updates', 'Non-location fields including photos unchanged except version/timestamp', 'Other profiles unchanged', 'Anonymous public address and coordinates verified'] };
const filename = path.join(directory, 'third-pass-location-receipt.json');
if (!fs.existsSync(filename) || pending.length) fs.writeFileSync(filename, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Verified ${pending.length} location corrections; ${unresolved.length} imported locations remain unconfirmed.`);
