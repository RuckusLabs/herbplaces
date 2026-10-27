// A live deployment must never contact Stripe with a leftover sandbox key.
export function assertStripeEnvironment(key, liveOnly) {
  if (liveOnly && (typeof key !== 'string' || !/^(rk|sk)_live_/.test(key))) {
    throw new Error('Live billing is being configured. Please check back soon.');
  }
}

export function billingEventMatchesEnvironment(event, liveOnly) {
  return !liveOnly || event?.livemode === true;
}
