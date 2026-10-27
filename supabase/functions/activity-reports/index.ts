import { createActivityReportHandler, dispatchActivityReports } from '../_shared/activityReports.js';
import { serviceClient } from '../_shared/server.ts';

Deno.serve(createActivityReportHandler({
  secret: Deno.env.get('ACTIVITY_REPORT_SECRET'),
  enabled: Deno.env.get('ACTIVITY_REPORTS_ENABLED') === 'true',
  dispatch: () => dispatchActivityReports({ database: serviceClient(), apiKey: Deno.env.get('RESEND_API_KEY'), from: Deno.env.get('CLAIM_EMAIL_FROM'), siteUrl: Deno.env.get('SITE_URL'),
    unsubscribeUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/activity-report-unsubscribe` }),
}));
