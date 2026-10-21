import { createClaimNotificationHandler, dispatchClaimNotifications } from '../_shared/claimNotifications.js';
import { serviceClient } from '../_shared/server.ts';
import { dispatchCustomerNotifications } from '../_shared/customerNotifications.js';

Deno.serve(createClaimNotificationHandler({
  secret: Deno.env.get('CLAIM_NOTIFICATION_SECRET'),
  dispatch: async () => {
    const config = { database: serviceClient(), apiKey: Deno.env.get('RESEND_API_KEY'),
      from: Deno.env.get('CLAIM_EMAIL_FROM'), siteUrl: Deno.env.get('SITE_URL') };
    if (!config.apiKey || !config.from || !config.siteUrl) throw new Error('Email delivery is not configured.');
    // Each queue can make progress if the other is unavailable. Concurrent
    // batches also keep worst-case delivery within the dispatch timeout.
    const batches = await Promise.allSettled([dispatchClaimNotifications(config), dispatchCustomerNotifications(config)]);
    return batches.reduce((total, batch) => batch.status === 'fulfilled'
      ? { sent: total.sent + batch.value.sent, failed: total.failed + batch.value.failed }
      : { ...total, failed: total.failed + 1 }, { sent: 0, failed: 0 });
  },
}));
