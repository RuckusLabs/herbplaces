import Stripe from 'npm:stripe@23.0.0';
import { json, required, stripeClient } from '../_shared/server.ts';
import { billingEventSubscriptionId } from '../_shared/billingEvents.js';
import { reconcileSubscription } from '../_shared/billing.ts';
import { billingEventMatchesEnvironment } from '../_shared/billingEnvironment.js';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let event: Stripe.Event;
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) return json({ error: 'Missing signature.' }, 400);
    event = await stripeClient().webhooks.constructEventAsync(await req.text(), signature, required('STRIPE_WEBHOOK_SECRET'),
      undefined, Stripe.createSubtleCryptoProvider());
  } catch { return json({ error: 'Invalid signature.' }, 400); }
  if (!billingEventMatchesEnvironment(event, Deno.env.get('STRIPE_LIVEMODE_REQUIRED') === 'true')) return json({ received: true, ignored: true });
  try {
    const subscriptionId = billingEventSubscriptionId(event);
    if (subscriptionId) {
      const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
      // This Stripe account can also contain unrelated products.
      if (subscription.metadata.place_id) await reconcileSubscription(subscriptionId, event.id, event.created,
        event.type === 'invoice.payment_failed' ? event.created : undefined);
    }
    return json({ received: true });
  } catch (error) {
    console.error('Stripe reconciliation failed', event.id, error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Reconciliation failed; retry delivery.' }, 500);
  }
});
