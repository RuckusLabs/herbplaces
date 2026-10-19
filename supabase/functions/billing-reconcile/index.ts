import { checked, json, required, serviceClient } from '../_shared/server.ts';
import { reconcileSubscription } from '../_shared/billing.ts';

// Schedule hourly with the secret Authorization header described in the setup guide.
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (req.headers.get('Authorization') !== `Bearer ${required('BILLING_RECONCILE_SECRET')}`) return json({ error: 'Unauthorized.' }, 401);
  try {
    const db = serviceClient();
    let count = 0;
    const failures: string[] = [];
    for (let page = 0; ; page++) {
      const rows = await checked(await db.from('place_subscriptions').select('stripe_subscription_id').not('stripe_subscription_id', 'is', null)
        .not('status', 'in', '(canceled,incomplete_expired)').order('place_id').range(page * 100, page * 100 + 99)) || [];
      for (const row of rows) {
        try { await reconcileSubscription(row.stripe_subscription_id, `reconcile-${crypto.randomUUID()}`, Math.floor(Date.now() / 1000)); count++; }
        catch { failures.push(row.stripe_subscription_id); }
      }
      if (rows.length < 100) break;
    }
    if (failures.length) console.error('Billing reconciliation failures', failures);
    return json({ reconciled: count, failures: failures.length }, failures.length ? 500 : 200);
  } catch { return json({ error: 'Billing reconciliation failed.' }, 500); }
});
