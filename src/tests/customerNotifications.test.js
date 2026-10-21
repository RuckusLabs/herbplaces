import test from 'node:test';
import assert from 'node:assert/strict';
import { customerNotificationEmail, dispatchCustomerNotifications } from '../../supabase/functions/_shared/customerNotifications.js';
const config = { apiKey: 'test-key', from: 'Little Herb Places <sender@example.com>', siteUrl: 'https://littleherbplaces.com' };
const payload = { account_email: 'owner@example.com', place_name: 'Moss Apothecary', place_slug: 'moss-apothecary', city: 'Denver', region: 'CO', website: 'https://example.com', notes: 'Please add our shop.', review_note: 'Please provide a link connecting you to the business.' };

test('claim decision emails address the account and link to the next action without promising a charge or approval', () => {
  const received = customerNotificationEmail({ kind: 'claim_received', payload }, config);
  assert.deepEqual(received.to, ['owner@example.com']); assert.match(received.text, /No payment has been taken/);
  const approved = customerNotificationEmail({ kind: 'claim_approved', payload }, config);
  assert.match(approved.text, /No subscription has been started/); assert.match(approved.text, /favorites#my-places/);
  const rejected = customerNotificationEmail({ kind: 'claim_rejected', payload }, config);
  assert.match(rejected.text, /provide a link/); assert.equal(rejected.html, undefined);
});
test('listing messages distinguish public listing creation from approved ownership', () => {
  const customer = customerNotificationEmail({ kind: 'listing_reviewed', payload: { ...payload, status: 'listed' } }, config);
  assert.match(customer.text, /submit an ownership claim/);
  const admin = customerNotificationEmail({ kind: 'listing_admin', payload: { ...payload, to: 'untrusted@example.com' } }, config);
  assert.deepEqual(admin.to, ['admin@littleherbplaces.com']); assert.match(admin.text, /admin/);
  assert.throws(() => customerNotificationEmail({ kind: 'unknown', payload }, config), /Unknown/);
  assert.throws(() => customerNotificationEmail({ kind: 'claim_received', payload: { ...payload, account_email: 'bad\r\nBcc:other@example.com' } }, config));
});
test('customer delivery retains idempotency and leases across successful sends and provider failures', async () => {
  for (const success of [true, false]) {
    const calls = []; let request;
    const database = { rpc: async (name, parameters) => {
      calls.push({ name, parameters });
      return { data: name === 'take_customer_notifications' ? [{ id: 'job-1', kind: 'claim_approved', payload, lease_token: 'lease-1' }] : null };
    } };
    const result = await dispatchCustomerNotifications({ ...config, database, fetchImpl: async (url, options) => { request = options; return success ? Response.json({ id: 'email-1' }) : new Response('', { status: 500 }); } });
    assert.equal(request.headers['Idempotency-Key'], 'place-customer/job-1');
    assert.deepEqual(calls[1].parameters, { p_id: 'job-1', p_lease_token: 'lease-1', p_email_id: success ? 'email-1' : null });
    assert.deepEqual(result, success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 });
  }
});
test('missing customer email configuration does not consume a queue attempt', async () => {
  let called = false;
  await assert.rejects(dispatchCustomerNotifications({ ...config, from: '', database: { rpc: async () => { called = true; } } }));
  assert.equal(called, false);
});
