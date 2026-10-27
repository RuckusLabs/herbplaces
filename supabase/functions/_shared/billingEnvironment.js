// A live deployment must never contact Stripe with a leftover sandbox key.
export function assertStripeEnvironment(key, liveOnly) {
  if (liveOnly && (typeof key !== 'string' || !/^(rk|sk)_live_/.test(key))) {
    throw new Error('Live billing is being configured. Please check back soon.');
  }
}

export function billingEventMatchesEnvironment(event, liveOnly) {
  return !liveOnly || event?.livemode === true;
}

export function checkoutTaxOptions(setting, price) {
  if (setting !== 'true') return {};
  if (price?.tax_behavior !== 'exclusive') throw new Error('Bloom price must add applicable tax at checkout.');
  return { automatic_tax: { enabled: true }, billing_address_collection: 'required', customer_update: { address: 'auto' } };
}
