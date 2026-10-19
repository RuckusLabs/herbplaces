import Stripe from 'npm:stripe@18.5.0';
import { json, required, stripeClient } from '../_shared/server.ts';
import { reconcileSubscription } from '../_shared/billing.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let event: Stripe.Event;
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) return json({ error: 'Missing signature.' }, 400);
    event = await stripeClient().webhooks.constructEventAsync(await req.text(), signature, required('STRIPE_WEBHOOK_SECRET'),
      undefined, Stripe.createSubtleCryptoProvider());
  } catch { return json({ error: 'Invalid signature.' }, 400); }
  try {
    let subscriptionId: string | undefined;
    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed'].includes(event.type)) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    } else if (['invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.finalization_failed'].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
    }
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
