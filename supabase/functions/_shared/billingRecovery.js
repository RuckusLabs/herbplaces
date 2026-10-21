// Search the customer's authoritative state even when no first webhook was saved.
// Iterate all Stripe pages so older subscriptions cannot be hidden by pagination.
export async function findPlaceSubscription(stripe, record) {
  if (!record.stripe_customer_id) return record.stripe_subscription_id || null;
  const subscriptions = [];
  for await (const subscription of stripe.subscriptions.list({ customer: record.stripe_customer_id, status: 'all', limit: 100 })) {
    if (subscription.metadata.place_id === String(record.place_id)) subscriptions.push(subscription);
  }
  const current = subscriptions.filter(item => !['canceled', 'incomplete_expired'].includes(item.status));
  if (current.length > 1) throw new Error('Multiple subscriptions need billing support review.');
  return current[0]?.id || subscriptions.sort((a, b) => b.created - a.created)[0]?.id || record.stripe_subscription_id || null;
}
