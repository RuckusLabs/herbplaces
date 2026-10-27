import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStripeEnvironment, billingEventMatchesEnvironment } from '../../supabase/functions/_shared/billingEnvironment.js';

test('live-only billing rejects test or malformed keys before constructing a client', () => {
  for (const key of ['rk_test_fixture', 'sk_test_fixture', 'not-a-key', '', null]) {
    assert.throws(() => assertStripeEnvironment(key, true), error => {
      assert.match(error.message, /^Live billing is being configured/);
      assert.ok(!key || !error.message.includes(key));
      return true;
    });
  }
  for (const key of ['rk_live_fixture', 'sk_live_fixture']) assert.doesNotThrow(() => assertStripeEnvironment(key, true));
});

test('an explicitly isolated non-live deployment retains its test-key compatibility', () => {
  assert.doesNotThrow(() => assertStripeEnvironment('rk_test_fixture', false));
});

test('live-only webhooks ignore authenticated events from another environment', () => {
  assert.equal(billingEventMatchesEnvironment({ livemode: true }, true), true);
  assert.equal(billingEventMatchesEnvironment({ livemode: false }, true), false);
  assert.equal(billingEventMatchesEnvironment({}, true), false);
  assert.equal(billingEventMatchesEnvironment({ livemode: false }, false), true);
});
