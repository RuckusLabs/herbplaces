import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNotificationEmail, dispatchAdminNotifications } from '../../supabase/functions/_shared/adminNotifications.js';
const config = { apiKey: 'test-key', from: 'Little Herb Places <admin@littleherbplaces.com>', siteUrl: 'https://littleherbplaces.com' };
const job = { id: 'job-1', kind: 'claims', place_name: 'Moss Apothecary', created_at: '2026-10-26', lease_token: 'lease-1' };

test('admin alerts have a fixed recipient, branded escaped content, and section-specific review links', () => {
  for (const kind of ['claims', 'listing-requests', 'locations']) {
    const email = adminNotificationEmail({ ...job, kind, place_name: '<img src=x>\r\nBcc: other@example.com', to: 'other@example.com' }, config);
    assert.deepEqual(email.to, ['lhp@ruckuslabs.co']);
    assert.ok(email.text.includes(`/admin?section=${kind}`));
    assert.ok(email.html.includes('little-herb-places-logo-v1.png'));
    assert.ok(email.html.includes('&lt;img src=x&gt;')); assert.ok(!email.html.includes('<img src=x>'));
    assert.ok(!/[\r\n]/.test(email.subject));
  }
  assert.throws(() => adminNotificationEmail({ ...job, kind: 'unknown' }, config));
  assert.throws(() => adminNotificationEmail(job, { ...config, siteUrl: 'javascript:alert(1)' }));
});

test('admin delivery preserves leases and idempotency on provider success and failure', async () => {
  for (const success of [true, false]) {
    const calls = []; let request;
    const database = { rpc: async (name, parameters) => { calls.push({ name, parameters }); return { data: name === 'take_admin_notifications' ? [job] : null }; } };
    const result = await dispatchAdminNotifications({ ...config, database, fetchImpl: async (_, options) => { request = options; return success ? Response.json({ id: 'email-1' }) : new Response('', { status: 503 }); } });
    assert.equal(request.headers['Idempotency-Key'], 'place-admin/job-1');
    assert.deepEqual(JSON.parse(request.body).to, ['lhp@ruckuslabs.co']);
    assert.deepEqual(calls[1].parameters, { p_id: job.id, p_lease_token: job.lease_token, p_email_id: success ? 'email-1' : null });
    assert.deepEqual(result, success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 });
  }
});
test('missing admin delivery configuration consumes no queue attempts', async () => {
  let called = false;
  await assert.rejects(dispatchAdminNotifications({ ...config, apiKey: '', database: { rpc: async () => { called = true; } } }));
  assert.equal(called, false);
});
