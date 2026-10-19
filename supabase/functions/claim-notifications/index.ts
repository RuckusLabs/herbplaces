import { createClaimNotificationHandler, dispatchClaimNotifications } from '../_shared/claimNotifications.js';
import { serviceClient } from '../_shared/server.ts';

Deno.serve(createClaimNotificationHandler({
  secret: Deno.env.get('CLAIM_NOTIFICATION_SECRET'),
  dispatch: () => dispatchClaimNotifications({
    database: serviceClient(), apiKey: Deno.env.get('RESEND_API_KEY'),
    from: Deno.env.get('CLAIM_EMAIL_FROM'), siteUrl: Deno.env.get('SITE_URL'),
  }),
}));
