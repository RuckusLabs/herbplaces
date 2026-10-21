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
  if (['invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.finalization_failed'].includes(event.type)) {
    const subscription = object.parent?.subscription_details?.subscription;
    return typeof subscription === 'string' ? subscription : subscription?.id;
  }
  return undefined;
}
