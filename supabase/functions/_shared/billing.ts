import type Stripe from 'npm:stripe@23.0.0';
import { checked, required, serviceClient, stripeClient } from './server.ts';
import { hasScheduledCancellation, renewalProcessingStart } from './billingEvents.js';
import { bloomPriceIds } from './billingCatalog.js';

// Always retrieve current Stripe state rather than trusting an old event payload.
export async function reconcileSubscription(subscriptionId: string, eventId: string, eventCreated: number, failedAt?: number) {
  const stripe = stripeClient();
  const db = serviceClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
  const placeId = subscription.metadata.place_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  if (!placeId) throw new Error('Missing place metadata.');
  const previous = await checked(await db.from('place_subscriptions').select('paid_until,stripe_customer_id,stripe_subscription_id,status').eq('place_id', placeId).single());
  if (!previous || previous.stripe_customer_id !== customerId) throw new Error('Customer mismatch.');
  const approvedPrices = bloomPriceIds(required('STRIPE_BLOOM_PRICE_ID'), Deno.env.get('STRIPE_BLOOM_PREVIOUS_PRICE_IDS'));
  const bloom = subscription.items.data.find(item => approvedPrices.includes(item.price.id) && item.quantity === 1);
  // Never provision an unrelated Stripe product as Bloom.
  const status = bloom ? subscription.status : 'unsupported';
  const invoice = subscription.latest_invoice as Stripe.Invoice | null;
  const paidUntil = bloom && status === 'active' && invoice?.status === 'paid'
    ? new Date(bloom.current_period_end * 1000).toISOString() : previous.paid_until;
  const processingStart = renewalProcessingStart(subscription, invoice, previous.paid_until, bloom?.current_period_start);
  const firstFailure = failedAt || (status === 'past_due' ? invoice?.status_transitions?.finalized_at || eventCreated : undefined);
  // The existing timestamp argument also anchors the bounded processing window
  // for an active renewal; actual payment failures retain their own seven days.
  const graceStart = status === 'past_due' ? firstFailure : processingStart;
  await checked(await db.rpc('apply_billing_event', {
    p_event_id: eventId, p_event_created: eventCreated, p_place_id: placeId,
    p_customer_id: customerId, p_subscription_id: subscription.id, p_status: status,
    p_paid_until: paidUntil || null, p_failed_at: graceStart ? new Date(graceStart * 1000).toISOString() : null,
    p_cancel_at_period_end: hasScheduledCancellation(subscription),
  }));
}
