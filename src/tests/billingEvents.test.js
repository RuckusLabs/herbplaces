import test from 'node:test';
import assert from 'node:assert/strict';
import { billingEventSubscriptionId } from '../../supabase/functions/_shared/billingEvents.js';

const event = (type, object) => ({ type, data: { object } });
test('unpaid or unrelated Checkout events cannot provision Bloom access', () => {
  for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    for (const payment_status of ['unpaid', 'no_payment_required', undefined]) {
      assert.equal(billingEventSubscriptionId(event(type, { payment_status, subscription: 'sub_test' })), undefined);
    }
  }
  assert.equal(billingEventSubscriptionId(event('checkout.session.expired', { payment_status: 'paid', subscription: 'sub_test' })), undefined);
  assert.equal(billingEventSubscriptionId(event('charge.succeeded', { subscription: 'sub_test' })), undefined);
});
test('paid synchronous and asynchronous Checkout events reconcile the associated subscription', () => {
  assert.equal(billingEventSubscriptionId(event('checkout.session.completed', { payment_status: 'paid', subscription: 'sub_test' })), 'sub_test');
  assert.equal(billingEventSubscriptionId(event('checkout.session.async_payment_succeeded', { payment_status: 'paid', subscription: { id: 'sub_test' } })), 'sub_test');
  assert.equal(billingEventSubscriptionId(event('checkout.session.completed', { payment_status: 'paid', subscription: null })), undefined);
});
test('subscription and invoice lifecycle events retain their subscription references', () => {
  for (const action of ['created', 'updated', 'deleted', 'paused', 'resumed']) assert.equal(billingEventSubscriptionId(event(`customer.subscription.${action}`, { id: 'sub_test' })), 'sub_test');
  for (const action of ['paid', 'payment_failed', 'payment_action_required', 'finalization_failed']) {
    assert.equal(billingEventSubscriptionId(event(`invoice.${action}`, { parent: { subscription_details: { subscription: 'sub_test' } } })), 'sub_test');
    assert.equal(billingEventSubscriptionId(event(`invoice.${action}`, { parent: { subscription_details: { subscription: { id: 'sub_test' } } } })), 'sub_test');
  }
  assert.equal(billingEventSubscriptionId(event('invoice.paid', { parent: null })), undefined);
});

test('scheduled portal cancellation is recognized even when the legacy flag is false', async () => {
  const { hasScheduledCancellation } = await import('../../supabase/functions/_shared/billingEvents.js');
  assert.equal(hasScheduledCancellation({ status: 'active', cancel_at_period_end: false, cancel_at: 1795278208, canceled_at: 1792599911 }), true);
  assert.equal(hasScheduledCancellation({ status: 'active', cancel_at_period_end: true, cancel_at: null }), true);
  assert.equal(hasScheduledCancellation({ status: 'active', cancel_at_period_end: false, cancel_at: null, canceled_at: 1792599911 }), false);
  assert.equal(hasScheduledCancellation({ status: 'canceled', cancel_at_period_end: false, cancel_at: 1795278208 }), false);
  for (const cancel_at of [0, -1, NaN, Infinity, '1795278208']) assert.equal(hasScheduledCancellation({status:'active',cancel_at}), false);
});

test('only a previously paid cycle invoice gets a fixed renewal-processing start', async () => {
  const { renewalProcessingStart } = await import('../../supabase/functions/_shared/billingEvents.js');
  const start = 1795278208;
  const paid = new Date(start * 1000).toISOString();
  const invoice = {status:'draft',billing_reason:'subscription_cycle',period_start:start-30*86400};
  assert.equal(renewalProcessingStart({status:'active'},invoice,paid,start),start);
  assert.equal(renewalProcessingStart({status:'active'},{...invoice,status:'open'},paid,start),start);
  for (const previous of [null,undefined,'invalid',new Date((start+1)*1000).toISOString()]) assert.equal(renewalProcessingStart({status:'active'},invoice,previous,start),undefined);
  for (const status of ['past_due','canceled','incomplete']) assert.equal(renewalProcessingStart({status},invoice,paid,start),undefined);
  assert.equal(renewalProcessingStart({status:'active',cancel_at:start},invoice,paid,start),undefined);
  assert.equal(renewalProcessingStart({status:'active'},{...invoice,billing_reason:'subscription_create'},paid,start),undefined);
  assert.equal(renewalProcessingStart({status:'active'},{...invoice,status:'paid'},paid,start),undefined);
});
