import test from 'node:test';
import assert from 'node:assert/strict';
import { claimNotificationEmail, createClaimNotificationHandler, dispatchClaimNotifications } from '../../supabase/functions/_shared/claimNotifications.js';

const payload = { claim_id: 'claim-1', place_name: 'Moss Apothecary', place_slug: 'moss-apothecary', account_email: 'owner@example.com',
  relationship: 'Owner', evidence: 'Full name: Jamie Green\nBusiness email: jamie@moss.example\nOur team page lists me as the owner.', submitted_at: '2026-10-19T12:00:00Z' };
const config = { apiKey: 'test-key', from: 'Test Sender <sender@example.com>', siteUrl: 'https://littleherbplaces.com' };
function database() {
  const calls = [];
  return { calls, rpc: async (name, parameters) => {
    calls.push({ name, parameters });
    return { data: name === 'take_claim_notifications' ? [{ claim_id: payload.claim_id, lease_token: 'lease-1', payload }] : null, error: null };
  } };
}

test('verification email includes ownership evidence and review links with a fixed recipient', () => {
  const email = claimNotificationEmail(payload, config);
  assert.deepEqual(email.to, ['admin@littleherbplaces.com']);
  for (const detail of ['Moss Apothecary', 'owner@example.com', 'Jamie Green', 'jamie@moss.example', 'Our team page', 'https://littleherbplaces.com/admin', '/place/moss-apothecary']) assert.ok(email.text.includes(detail));
  assert.equal(email.html, undefined); // User-provided evidence remains plain text.
  assert.equal(claimNotificationEmail({ ...payload, place_name: 'A\r\nB' }, config).subject, 'New place claim: A  B');
});

test('successful delivery uses a stable idempotency key and records the provider message ID', async () => {
  const db = database(); let delivered;
  const result = await dispatchClaimNotifications({ ...config, database: db, fetchImpl: async (url, request) => {
    delivered = { url, request }; return Response.json({ id: 'email-1' });
  } });
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.equal(delivered.url, 'https://api.resend.com/emails');
  assert.equal(delivered.request.headers['Idempotency-Key'], 'place-claim/claim-1');
  assert.deepEqual(JSON.parse(delivered.request.body).to, ['admin@littleherbplaces.com']);
  assert.equal(db.calls[1].parameters.p_email_id, 'email-1');
});

test('provider and network failures leave the claim notification available for retry', async () => {
  for (const fetchImpl of [async () => new Response('Unavailable', { status: 503 }), async () => { throw new Error('offline'); }, async () => Response.json({})]) {
    const db = database();
    assert.deepEqual(await dispatchClaimNotifications({ ...config, database: db, fetchImpl }), { sent: 0, failed: 1 });
    assert.equal(db.calls[1].parameters.p_email_id, null);
  }
});

test('missing email configuration does not consume a delivery attempt', async () => {
  const db = database();
  await assert.rejects(dispatchClaimNotifications({ ...config, apiKey: '', database: db }), /not configured/);
  assert.equal(db.calls.length, 0);
});

test('only the server webhook secret can dispatch notifications; arbitrary request bodies are ignored', async () => {
  let dispatches = 0;
  const handler = createClaimNotificationHandler({ secret: 'test-secret', dispatch: async () => { dispatches++; return { sent: 1, failed: 0 }; } });
  assert.equal((await handler(new Request('https://example.com', { method: 'POST' }))).status, 401);
  assert.equal((await handler(new Request('https://example.com', { method: 'GET' }))).status, 405);
  assert.equal(dispatches, 0);
  const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer test-secret' }, body: JSON.stringify({ to: 'attacker@example.com', evidence: 'forged' }) }));
  assert.equal(response.status, 200);
  assert.equal(dispatches, 1);
});

test('delivery failures return a retryable status without exposing email contents or credentials', async () => {
  const handler = createClaimNotificationHandler({ secret: 'test-secret', dispatch: async () => { throw new Error('private-secret and ownership details'); } });
  const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer test-secret' } }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private-secret'));
});
