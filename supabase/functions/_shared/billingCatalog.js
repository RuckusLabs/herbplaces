// Public offer definitions are shared with website copy. Stripe IDs stay server-side.
// New offers remain unavailable until their features and customer terms are reviewed.
export const bloomOffer = Object.freeze({ key: 'bloom-monthly-launch', plan: 'bloom', amount: 1900, currency: 'usd', interval: 'month', intervalCount: 1, label: '$19/month per place, plus applicable tax' });
export const thriveOffer = Object.freeze({ key: 'thrive-monthly-pilot', plan: 'thrive', amount: 4900, currency: 'usd', interval: 'month', intervalCount: 1, label: '$49/month per place' });

export function bloomPriceIds(primaryId, previousIds = '') {
  const ids = [primaryId, ...previousIds.split(',')].map(value => value?.trim()).filter(Boolean);
  if (!primaryId || ids.some(id => !/^price_[a-zA-Z0-9_]+$/.test(id))) throw new Error('Bloom price configuration is invalid.');
  return [...new Set(ids)];
}

export function validateCheckoutPrice(price) {
  if (!price.active || price.currency !== bloomOffer.currency || price.unit_amount !== bloomOffer.amount
    || price.recurring?.interval !== bloomOffer.interval || price.recurring.interval_count !== bloomOffer.intervalCount
    || price.recurring.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit') {
    throw new Error('Bloom price configuration does not match the advertised offer.');
  }
  return price;
}
