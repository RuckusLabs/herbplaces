// Explicit, opt-in hosted smoke test. Creates temporary accounts/listing/photos,
// exercises real Auth/REST/Storage/Edge Functions, and removes its fixtures.
// Notification delivery must be inactive: this never sends test mail to customers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const projectRef = 'qtpepsebztlremlhpxdt';
const config = fs.readFileSync('.env.local', 'utf8');
const setting = name => config.match(new RegExp(`^${name}\\s*=\\s*['\"]?([^\\s'\"]+)`, 'm'))?.[1];
const url = setting('VITE_SUPABASE_URL');
assert.equal(new URL(url).hostname, `${projectRef}.supabase.co`, 'Refusing to test an unexpected project.');
const anonKey = setting('VITE_SUPABASE_ANON_KEY');
const raw = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', projectRef, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const result = JSON.parse(raw);
const keys = Array.isArray(result) ? result : result.api_keys || result.keys || result.data || [];
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
assert.ok(serviceKey, 'A server key is required for temporary test fixtures.');
// Keys remain in this process only and are never written or printed.
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
  headers: { Origin: 'http://localhost:5173' },
  fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(45000) }),
} };
const service = createClient(url, serviceKey, options);
const administrator = createClient(url, anonKey, options);
const manager = createClient(url, anonKey, options);
const anonymous = createClient(url, anonKey, options);
const users = [];
const deletedUsers = new Set();
let placeId = null;
const suffix = crypto.randomUUID();
const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
let createdPlace = false;

async function value(request) {
  const response = await request;
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
async function account(client, role) {
  const email = `beta-${role}-${suffix}@herbplaces.test`;
  const { user } = await value(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(user.id);
  await value(client.auth.signInWithPassword({ email, password }));
  return user;
}
function passed(message) { console.log(`PASS ${message}`); }
function databaseRows(query) {
  const output = execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', projectRef, '--output', 'json', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output).rows;
}
function fixtureId(id) { assert.match(id, /^[0-9a-f-]{36}$/); return id; }
async function useGeneratedLink(link, expected, client) {
  const response = await fetch(link, { redirect: 'manual' });
  assert.ok(response.status >= 300 && response.status < 400, 'The account link must redirect.');
  const location = new URL(response.headers.get('location'));
  assert.ok(`${location.origin}${location.pathname}${location.search}` === expected, 'The account link did not preserve its allowed return destination.');
  const tokens = new URLSearchParams(location.hash.slice(1));
  assert.ok(tokens.get('access_token') && tokens.get('refresh_token'), 'The account link did not create a valid session.');
  await value(client.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') }));
}

try {
  const dispatch = databaseRows("select count(*) as count from pg_trigger where tgname in ('dispatch_claim_notification','dispatch_customer_notification') and tgenabled <> 'D'")[0];
  assert.equal(dispatch.count, 0, 'Use an isolated project once real email dispatch is active.');
  const cron = databaseRows("select to_regclass('cron.job') is not null as installed")[0];
  if (cron.installed) assert.equal(databaseRows("select count(*) as count from cron.job where active and jobname='claim-notification-retries'")[0].count, 0, 'Use an isolated project once notification scheduling is active.');
  const accountClient = createClient(url, anonKey, options);
  const accountEmail = `beta-account-${suffix}@herbplaces.test`;
  const callback = 'https://littleherbplaces.com/auth/callback?next=%2Frequest-place';
  const generated = await value(service.auth.admin.generateLink({ type: 'signup', email: accountEmail, password, options: { redirectTo: callback } }));
  users.push(generated.user.id);
  await useGeneratedLink(generated.properties.action_link, callback, accountClient);
  assert.ok((await value(accountClient.auth.getUser())).user.email_confirmed_at);
  const resetTarget = 'http://127.0.0.1:5181/auth/reset-password?next=%2Ffavorites';
  const recovery = await value(service.auth.admin.generateLink({ type: 'recovery', email: accountEmail, options: { redirectTo: resetTarget } }));
  await useGeneratedLink(recovery.properties.action_link, resetTarget, accountClient);
  const newPassword = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  await value(accountClient.auth.updateUser({ password: newPassword }));
  await value(accountClient.auth.signOut());
  await value(accountClient.auth.signInWithPassword({ email: accountEmail, password: newPassword }));
  const reused = await fetch(recovery.properties.action_link, { redirect: 'manual' });
  assert.ok(new URL(reused.headers.get('location')).hash.includes('error='), 'A used recovery link must not create another session.');
  const unsafe = await value(service.auth.admin.generateLink({ type: 'recovery', email: accountEmail, options: { redirectTo: 'https://example.org/unapproved' } }));
  const rejected = await fetch(unsafe.properties.action_link, { redirect: 'manual' });
  assert.ok(new URL(rejected.headers.get('location')).origin === 'https://littleherbplaces.com', 'Unapproved return origins must be rejected.');
  passed('Real confirmation/recovery links, validated return destinations, password update, and used-link rejection (no mailbox delivery)');

  const adminUser = await account(administrator, 'admin');
  const managerUser = await account(manager, 'manager');
  await value(service.from('site_admins').insert({ user_id: adminUser.id }));
  const creation = { p_request_id: suffix, p_slug: `beta-verification-${suffix}`, p_content: {
    name: `Temporary Beta Verification ${suffix}`, tagline: 'Temporary test fixture', description: 'Original verification content',
    city: 'Denver', state: 'CO', address: '', zip: '', website: '', phone: '', hours: '',
    photos: [], coverPhoto: '', photo_alt: {}, category_ids: [], social_links: [],
  } };
  assert.ok((await manager.rpc('admin_create_place', creation)).error, 'Only administrators may create listings.');
  const created = await value(administrator.rpc('admin_create_place', creation));
  placeId = created.id; createdPlace = true;
  assert.equal((await value(administrator.rpc('admin_create_place', creation))).id, placeId);
  assert.equal(created.is_claimed, false); assert.equal(created.isFeatured, false);
  assert.equal((await value(service.from('place_subscriptions').select('status').eq('place_id',placeId).single())).status, 'none');
  passed('Administrator place creation, native ID generation, retry protection, and billing initialization');
  assert.equal((await value(anonymous.from('public_places').select('id').eq('id', placeId))).length, 1);
  assert.equal((await value(anonymous.from('places').select('*').eq('id', placeId))).length, 1);
  passed('New and legacy public directory endpoints');

  const context = await value(administrator.rpc('get_management_context'));
  assert.equal(context.is_admin, true);
  assert.equal((await value(manager.rpc('get_management_context'))).is_admin, false);
  const privateRead = await anonymous.from('place_memberships').select('*');
  assert.ok(privateRead.error, 'Private memberships must not be public.');
  const deniedAdmin = await manager.rpc('admin_directory', { p_section: 'users' });
  assert.ok(deniedAdmin.error, 'An ordinary account must not list users.');
  passed('Confirmed accounts, admin access, and private data boundaries');

  const listingRequest = { p_name: `Temporary Listing Request ${suffix}`, p_website: 'https://example.com/', p_city: 'Denver', p_region: 'CO', p_notes: 'Temporary hosted test; removed after verification.', p_request_id: suffix };
  assert.ok((await anonymous.rpc('request_place_listing', listingRequest)).error);
  const requested = await value(manager.rpc('request_place_listing', listingRequest));
  assert.equal(await value(manager.rpc('request_place_listing', listingRequest)), requested);
  assert.equal((await value(manager.rpc('get_listing_requests'))).find(item => item.id === requested).status, 'pending');
  assert.deepEqual(await value(administrator.rpc('get_listing_requests')), []);
  assert.ok((await manager.rpc('admin_listing_requests')).error);
  const listingQueue = await value(administrator.rpc('admin_listing_requests', { p_query: suffix }));
  assert.equal(listingQueue.items.find(item => item.id === requested).email, managerUser.email);
  await value(administrator.rpc('admin_review_listing_request', { p_request_id: requested, p_slug: created.urlSlug, p_note: 'Temporary listing linked. Ownership must be claimed separately.' }));
  assert.equal((await value(manager.rpc('get_listing_requests'))).find(item => item.id === requested).status, 'listed');
  assert.equal((await value(manager.rpc('get_management_context'))).memberships.length, 0);
  for (const table of ['place_listing_requests', 'place_customer_notifications', 'place_claim_notifications']) {
    assert.ok((await anonymous.from(table).select('*')).error);
    assert.ok((await manager.from(table).select('*')).error);
  }
  passed('Private listing requests, retry protection, admin review, and independent ownership approval');

  await value(manager.rpc('request_place_claim', { p_place_id: String(placeId), p_relationship: 'Test manager', p_evidence: 'Temporary beta verification claim; removed after testing.' }));
  const managerContext = await value(manager.rpc('get_management_context'));
  let claim = managerContext.claims.find(item => String(item.place_id) === String(placeId));
  assert.ok(claim);
  await value(administrator.rpc('admin_review_claim', { p_claim_id: claim.id, p_approve: false, p_note: 'Temporary rejection: please provide updated ownership details.' }));
  const reviewed = (await value(manager.rpc('get_management_context'))).claims.find(item => item.id === claim.id);
  assert.equal(reviewed.status, 'rejected'); assert.match(reviewed.review_note, /updated ownership/);
  await value(manager.rpc('request_place_claim', { p_place_id: String(placeId), p_relationship: 'Test manager', p_evidence: 'Updated temporary verification details; removed after testing.' }));
  claim = (await value(manager.rpc('get_management_context'))).claims.find(item => String(item.place_id) === String(placeId) && item.status === 'pending');
  await value(administrator.rpc('admin_review_claim', { p_claim_id: claim.id, p_approve: true, p_note: 'Temporary verification.' }));
  const approved = await value(manager.rpc('get_management_context'));
  const membership = approved.memberships.find(item => String(item.place_id) === String(placeId));
  assert.equal(membership.is_billing_contact, true);
  assert.equal(membership.can_edit, false);
  assert.equal((await value(anonymous.from('public_places').select('isVerified').eq('id', placeId).single())).isVerified, true);
  const notificationKinds = databaseRows(`select kind,count(*) as count from public.place_customer_notifications where user_id='${fixtureId(managerUser.id)}'::uuid group by kind`);
  assert.equal(notificationKinds.find(item => item.kind === 'claim_received').count, 2);
  for (const kind of ['claim_rejected','claim_approved','listing_received','listing_reviewed','listing_admin']) assert.equal(notificationKinds.find(item => item.kind === kind).count, 1);
  passed('Visible claim rejection/resubmission, free ownership verification, and durable private decision messages');
  assert.ok((await manager.rpc('get_editable_place', { p_place_id: String(placeId) })).error);
  assert.equal((await value(anonymous.from('public_places').select('is_claimed').eq('id', placeId).single())).is_claimed, true);
  assert.ok((await administrator.rpc('request_place_claim', { p_place_id: String(placeId), p_relationship: 'Test manager', p_evidence: 'Already claimed verification.' })).error);
  const directory = await value(administrator.rpc('admin_directory', { p_section: 'users', p_query: suffix, p_sort: 'place_count', p_desc: true }));
  assert.equal(directory.items[0].user_id, managerUser.id); assert.equal(directory.items[0].places[0].id, String(placeId));
  assert.equal(directory.items[0].places[0].is_billing_contact, true);
  const selfRemoval = await administrator.functions.invoke('admin-users', { body: { action: 'remove', user_id: adminUser.id, email: adminUser.email } });
  assert.ok(selfRemoval.error, 'Self-removal must fail.');
  await value(service.from('place_subscriptions').update({ status: 'active', paid_until: new Date(Date.now() + 86400000).toISOString() }).eq('place_id', placeId));
  const billingRemoval = await administrator.functions.invoke('admin-users', { body: { action: 'remove', user_id: managerUser.id, email: managerUser.email } });
  if (billingRemoval.data?.removed) deletedUsers.add(managerUser.id);
  assert.ok(billingRemoval.error, 'An active billing contact must be reassigned before removal.');
  assert.equal((await value(service.auth.admin.getUserById(managerUser.id))).user.id, managerUser.id);
  await value(service.from('place_subscriptions').update({ status: 'none', paid_until: null }).eq('place_id', placeId));
  passed('Claim ownership, sorted manager directory, and account-removal protections');

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=', 'base64');
  const photo = new FormData();
  photo.set('action', 'upload'); photo.set('place_id', String(placeId));
  photo.set('file', new Blob([png], { type: 'image/png' }), 'verification.png');
  const uploaded = await value(administrator.functions.invoke('place-management', { body: photo }));
  assert.ok(uploaded.url, 'Upload did not return a photo URL.');
  const imageResponse = await fetch(uploaded.url);
  assert.equal(imageResponse.status, 200);
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), png);
  passed('Authenticated server upload, registration, and public photo delivery');

  const content = { name: 'Temporary Beta Verification', tagline: 'Verified through the hosted API', description: 'Published verification content',
    website: '', address: '', city: 'Denver', state: 'CO', zip: '02108-1234', phone: '555-0100', hours: 'Test hours',
    social_links: [], category_ids: ['shops'], photos: [uploaded.url], coverPhoto: uploaded.url, photo_alt: { [uploaded.url]: 'Temporary verification pixel' } };
  const published = await value(administrator.rpc('publish_place', { p_place_id: String(placeId), p_content: content, p_expected_version: 1 }));
  assert.equal(published.content_version, 2); assert.equal(published.zip, '02108-1234');
  const conflict = await administrator.rpc('publish_place', { p_place_id: String(placeId), p_content: content, p_expected_version: 1 });
  assert.equal(conflict.status, 409); assert.equal(conflict.error?.code, 'PT409');
  const detail = await value(administrator.rpc('admin_place_detail', { p_place_id: String(placeId) }));
  assert.equal(detail.revisions.length, 1);
  const restored = await value(administrator.rpc('admin_restore_place', { p_place_id: String(placeId), p_revision_id: detail.revisions[0].id, p_expected_version: 2 }));
  assert.equal(restored.content_version, 3); assert.equal(restored.description, 'Original verification content');
  passed('Publishing, numeric ZIP migration, conflicts, and revision restoration');

  await value(administrator.rpc('admin_remove_manager', { p_place_id: String(placeId), p_user_id: managerUser.id }));
  assert.ok((await manager.rpc('get_editable_place', { p_place_id: String(placeId) })).error);
  const preflight = await fetch(`${url}/functions/v1/place-management`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const unauthorized = await fetch(`${url}/functions/v1/place-management`, { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload', place_id: String(placeId) }) });
  assert.ok(unauthorized.status >= 400);
  const invalidWebhook = await fetch(`${url}/functions/v1/stripe-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalidWebhook.status, 400);
  const unauthorizedReconcile = await fetch(`${url}/functions/v1/billing-reconcile`, { method: 'POST' });
  assert.equal(unauthorizedReconcile.status, 401);
  const unconfiguredNotifications = await fetch(`${url}/functions/v1/claim-notifications`, { method: 'POST' });
  assert.ok([401,503].includes(unconfiguredNotifications.status));
  passed('Revocation, localhost CORS, and protected function endpoints');

  await value(administrator.rpc('admin_assign_manager', { p_place_id: String(placeId), p_email: managerUser.email, p_billing: false }));
  const forbiddenRemoval = await manager.functions.invoke('admin-users', { body: { action: 'remove', user_id: adminUser.id, email: adminUser.email } });
  assert.ok(forbiddenRemoval.error, 'Ordinary users must not remove accounts.');
  const removed = await value(administrator.functions.invoke('admin-users', { body: { action: 'remove', user_id: managerUser.id, email: managerUser.email } }));
  assert.equal(removed.removed, true); deletedUsers.add(managerUser.id);
  assert.ok((await service.auth.admin.getUserById(managerUser.id)).error);
  assert.equal((await value(service.from('place_memberships').select('user_id').eq('user_id', managerUser.id))).length, 0);
  assert.equal((await value(anonymous.from('public_places').select('id,is_claimed').eq('id', placeId).single())).is_claimed, false);
  assert.equal((await value(service.from('places').select('id').eq('id', placeId))).length, 1);
  assert.ok((await manager.rpc('get_management_context')).error, 'The removed account token must lose management access immediately.');
  passed('Real Auth account removal, access revocation, and published listing preservation');
} catch (failure) {
  console.error('Verification failed:', failure.message); throw failure;
} finally {
  const failures = [];
  try {
    const files = createdPlace ? await value(service.storage.from('place-photos').list(String(placeId))) : [];
    if (files?.length) await value(service.storage.from('place-photos').remove(files.map(file => `${placeId}/${file.name}`)));
  } catch { failures.push('photo cleanup'); }
  if (createdPlace) {
    try { await value(service.from('management_audit').delete().eq('place_id', String(placeId))); await value(service.from('places').delete().eq('id', placeId)); }
    catch { failures.push('listing cleanup'); }
  }
  try { await value(service.from('management_audit').delete().in('actor_id', users)); } catch { failures.push('audit cleanup'); }
  for (const userId of users) {
    if (deletedUsers.has(userId)) continue;
    try { await value(service.auth.admin.deleteUser(userId)); }
    catch (failure) { console.error('Account cleanup failed:', userId, failure.message); failures.push('account cleanup'); }
  }
  if (failures.length) throw new Error(`Verification cleanup requires attention: ${failures.join(', ')}. Fixture place ID: ${placeId}`);
  passed('Temporary listings, accounts, and photos removed');
}
