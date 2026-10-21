import { checked, json, required, serviceClient, stripeClient } from '../_shared/server.ts';
import { reconcileSubscription } from '../_shared/billing.ts';
import { findPlaceSubscription } from '../_shared/billingRecovery.js';

// Schedule hourly with the secret Authorization header described in the setup guide.
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (req.headers.get('Authorization') !== `Bearer ${required('BILLING_RECONCILE_SECRET')}`) return json({ error: 'Unauthorized.' }, 401);
  try {
    const db = serviceClient();
    const stripe = stripeClient();
    let count = 0;
    const failures: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      let query = db.from('place_subscriptions').select('place_id,stripe_customer_id,stripe_subscription_id')
        .not('stripe_customer_id', 'is', null).order('place_id').limit(100);
      if (cursor !== null) query = query.gt('place_id', cursor);
      const rows = await checked(await query) || [];
      for (const row of rows) {
        try {
          const subscriptionId = await findPlaceSubscription(stripe, row);
          if (subscriptionId) { await reconcileSubscription(subscriptionId, `reconcile-${crypto.randomUUID()}`, Math.floor(Date.now() / 1000)); count++; }
        } catch { failures.push(String(row.place_id)); }
      }
      if (rows.length < 100) break;
      cursor = String(rows[rows.length - 1].place_id);
    }
    if (failures.length) console.error('Billing reconciliation failures', failures);
    return json({ reconciled: count, failures: failures.length }, failures.length ? 500 : 200);
  } catch { return json({ error: 'Billing reconciliation failed.' }, 500); }
});
