// Checkout completion alone does not prove that an asynchronous payment cleared.
// Reconciliation still retrieves the current subscription and its paid invoice.
export function billingEventSubscriptionId(event) {
  const object = event?.data?.object;
  if (!object) return undefined;
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    if (object.payment_status !== 'paid') return undefined;
    return typeof object.subscription === 'string' ? object.subscription : object.subscription?.id;
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed'].includes(event.type)) return object.id;
  if (['invoice.created', 'invoice.finalized', 'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.finalization_failed'].includes(event.type)) {
    const subscription = object.parent?.subscription_details?.subscription;
    return typeof subscription === 'string' ? subscription : subscription?.id;
  }
  return undefined;
}

// The portal can schedule cancellation with cancel_at while leaving the legacy
// cancel_at_period_end flag false. canceled_at is the request date, not expiry.
export function hasScheduledCancellation(subscription) {
  if (['canceled', 'incomplete_expired'].includes(subscription.status)) return false;
  return subscription.cancel_at_period_end === true
    || (typeof subscription.cancel_at === 'number' && Number.isFinite(subscription.cancel_at) && subscription.cancel_at > 0);
}

// An unpaid first invoice never qualifies. Stripe may leave a renewing
// subscription active while its cycle invoice is being finalized/collected.
export function renewalProcessingStart(subscription, invoice, previousPaidUntil, cycleStart) {
  const previous = Date.parse(previousPaidUntil || '') / 1000;
  if (subscription.status !== 'active' || hasScheduledCancellation(subscription)
    || !['draft', 'open'].includes(invoice?.status) || invoice?.billing_reason !== 'subscription_cycle'
    || !Number.isFinite(previous) || typeof cycleStart !== 'number'
    || !Number.isFinite(cycleStart) || cycleStart < previous) return undefined;
  return cycleStart;
}
