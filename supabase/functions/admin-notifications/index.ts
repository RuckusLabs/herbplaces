import { createClaimNotificationHandler } from '../_shared/claimNotifications.js';
import { dispatchAdminNotifications } from '../_shared/adminNotifications.js';
import { serviceClient } from '../_shared/server.ts';

Deno.serve(createClaimNotificationHandler({
  secret: Deno.env.get('ADMIN_NOTIFICATION_SECRET'),
  dispatch: () => dispatchAdminNotifications({ database: serviceClient(), apiKey: Deno.env.get('RESEND_API_KEY'),
    from: Deno.env.get('CLAIM_EMAIL_FROM'), siteUrl: Deno.env.get('SITE_URL') }),
}));
