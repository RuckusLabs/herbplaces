import { createReportUnsubscribeHandler } from '../_shared/activityReports.js';
import { serviceClient } from '../_shared/server.ts';

Deno.serve(createReportUnsubscribeHandler({ siteUrl: Deno.env.get('SITE_URL'), origins: (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('SITE_URL') || '').split(',').map(value => value.trim()), unsubscribe: async token => {
  const { error } = await serviceClient().rpc('unsubscribe_activity_emails', { p_token: token });
  if (error) throw error;
} }));
