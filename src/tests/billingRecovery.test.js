import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlaceSubscription } from '../../supabase/functions/_shared/billingRecovery.js';
import { bloomPriceIds, validateCheckoutPrice } from '../../supabase/functions/_shared/billingCatalog.js';

const record = { place_id: '42', stripe_customer_id: 'cus_42', stripe_subscription_id: null };
function provider(rows) {
  return { subscriptions: { list: function* (parameters) {
    assert.equal(parameters.customer, 'cus_42');
    yield* rows;
  } } };
}
const subscription = (id, status = 'active', created = 100, place = '42') => ({ id, status, created, metadata: { place_id: place } });
test('billing recovery finds the first paid subscription without a saved webhook or customer return', async () => {
  assert.equal(await findPlaceSubscription(provider([subscription('sub_new')]), record), 'sub_new');
  assert.equal(await findPlaceSubscription(provider([]), record), null);
});
test('billing recovery ignores unrelated places and chooses a current subscription over canceled history', async () => {
  assert.equal(await findPlaceSubscription(provider([subscription('sub_old', 'canceled', 1), subscription('sub_other', 'active', 1000, 'other'), subscription('sub_new', 'past_due', 10)]), record), 'sub_new');
  assert.equal(await findPlaceSubscription(provider([subscription('sub_old', 'canceled', 1), subscription('sub_recent', 'canceled', 5)]), record), 'sub_recent');
});
test('ambiguous subscriptions require support instead of assigning an arbitrary purchase', async () => {
  await assert.rejects(findPlaceSubscription(provider([subscription('one'), subscription('two')]), record), /support review/);
});
test('billing recovery searches beyond the first Stripe page and propagates provider failures', async () => {
  const stripe = { subscriptions: { list: async function* () {
    for (let i = 0; i < 150; i++) yield subscription(`old-${i}`, 'canceled', i);
    yield subscription('paid-on-next-page');
  } } };
  assert.equal(await findPlaceSubscription(stripe, record), 'paid-on-next-page');
  await assert.rejects(findPlaceSubscription({ subscriptions: { list: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('Stripe unavailable')) }) }) } }, record), /unavailable/);
});
test('price validation enforces the advertised charge while retaining explicitly approved legacy IDs', () => {
  const price = { active: true, currency: 'usd', unit_amount: 1900, billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
  validateCheckoutPrice(price);
  for (const changed of [{ active: false }, { currency: 'cad' }, { unit_amount: 2900 }, { recurring: { ...price.recurring, interval: 'year' } }, { billing_scheme: 'tiered' }, { recurring: { ...price.recurring, usage_type: 'metered' } }]) assert.throws(() => validateCheckoutPrice({ ...price, ...changed }), /advertised offer/);
  assert.deepEqual(bloomPriceIds('price_current', 'price_old, price_older,price_current'), ['price_current', 'price_old', 'price_older']);
  assert.throws(() => bloomPriceIds('price_current', 'prod_not_a_price'));
});
