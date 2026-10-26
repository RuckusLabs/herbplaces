// Read-only hosted launch audit. Reports configuration presence, never secret values.
// Run again after configuring Stripe, transactional email, and the schedulers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const projectRef = 'qtpepsebztlremlhpxdt';
const env = fs.readFileSync('.env.local', 'utf8');
const setting = name => env.match(new RegExp(`^${name}\\s*=\\s*['\"]?([^\\s'\"]+)`, 'm'))?.[1];
const url = setting('VITE_SUPABASE_URL');
assert.equal(new URL(url).hostname, `${projectRef}.supabase.co`, 'Unexpected project; refusing to inspect it.');
function cli(args) {
  return JSON.parse(execFileSync('supabase', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
function query(sql) {
  return cli(['db', 'query', '--linked', '--project-ref', projectRef, '--output', 'json', sql]).rows;
}

try {
  const secrets = cli(['secrets', 'list', '--project-ref', projectRef, '--output', 'json']);
  const names = new Set(secrets.map(secret => secret.name));
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_BLOOM_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'BILLING_RECONCILE_SECRET', 'RESEND_API_KEY', 'CLAIM_EMAIL_FROM', 'CLAIM_NOTIFICATION_SECRET', 'ADMIN_NOTIFICATION_SECRET'];
  const missingSecrets = required.filter(name => !names.has(name));
  const enabledDigest = crypto.createHash('sha256').update('true').digest('hex');
  const purchasesEnabled = secrets.find(secret => secret.name === 'BLOOM_ENABLED')?.value === enabledDigest;
  const schema = query(`select jsonb_build_object(
    'listing_requests',to_regclass('public.place_listing_requests') is not null,
    'claim_notifications',to_regclass('public.place_claim_notifications') is not null,
    'customer_notifications',to_regclass('public.place_customer_notifications') is not null,
    'admin_notifications',to_regclass('public.place_admin_notifications') is not null,
    'cron',to_regclass('cron.job') is not null,
    'pg_net',exists(select 1 from pg_extension where extname='pg_net'),
    'places',(select count(*) from public.places),
    'subscriptions',(select count(*) from public.place_subscriptions),
    'vault_secret_names',(select coalesce(jsonb_agg(name),'[]'::jsonb) from vault.secrets)
  ) as state`)[0].state;
  const jobs = schema.cron ? query("select jobname,active from cron.job where jobname in ('bloom-billing-reconciliation','claim-notification-retries','admin-notification-retries')") : [];
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: setting('VITE_SUPABASE_ANON_KEY') }, signal: AbortSignal.timeout(15000) });
  assert.ok(settingsResponse.ok, 'Public authentication settings are unavailable.');
  const auth = await settingsResponse.json();
  const queue = query(`select jsonb_build_object(
    'claim_unsent',(select count(*) from public.place_claim_notifications where sent_at is null),
    'customer_unsent',(select count(*) from public.place_customer_notifications where sent_at is null and suppressed_at is null and kind <> 'listing_admin'),
    'customer_suppressed',(select count(*) from public.place_customer_notifications where suppressed_at is not null),
    'exhausted',(select count(*) from public.place_claim_notifications where sent_at is null and (attempts>=8 or first_attempt_at<=now()-interval '23 hours'))
      +(select count(*) from public.place_customer_notifications where sent_at is null and suppressed_at is null and kind <> 'listing_admin' and (attempts>=8 or first_attempt_at<=now()-interval '23 hours'))
  ) as state`)[0].state;
  const adminQueue = schema.admin_notifications ? query("select jsonb_build_object('sent',count(*) filter(where sent_at is not null),'unsent',count(*) filter(where sent_at is null),'exhausted',count(*) filter(where sent_at is null and (attempts>=8 or first_attempt_at<=now()-interval '23 hours'))) as state from public.place_admin_notifications")[0].state : null;
  const blockers = [];
  if (!schema.admin_notifications) blockers.push('Admin attention migration is missing.');
  if (adminQueue?.exhausted) blockers.push('Admin notification delivery has exhausted jobs requiring investigation.');
  if (missingSecrets.length) blockers.push('Stripe and/or notification credentials are missing.');
  if (auth.mailer_autoconfirm !== false) blockers.push('Enable email confirmation after custom account email delivery is verified.');
  if (!schema.listing_requests || !schema.claim_notifications || !schema.customer_notifications) blockers.push('Customer launch database migration is missing.');
  if (!schema.cron || !schema.pg_net) blockers.push('Scheduler extensions are not installed.');
  for (const name of ['bloom-billing-reconciliation', 'claim-notification-retries', 'admin-notification-retries']) if (!jobs.some(job => job.jobname === name && job.active)) blockers.push(`Scheduler is inactive: ${name}.`);
  for (const name of ['billing_reconcile_url', 'billing_reconcile_secret', 'claim_notification_url', 'claim_notification_secret', 'admin_notification_url', 'admin_notification_secret']) if (!schema.vault_secret_names.includes(name)) blockers.push(`Vault configuration is missing: ${name}.`);
  if (queue.exhausted) blockers.push('Notification delivery has exhausted jobs requiring investigation.');
  const report = { project: projectRef, checked_at: new Date().toISOString(), purchases_enabled: purchasesEnabled,
    configuration_ready: blockers.length === 0, missing_server_secrets: missingSecrets, email_confirmation_required: auth.mailer_autoconfirm === false,
    places: schema.places, subscriptions: schema.subscriptions, notification_queue: queue, admin_notification_queue: adminQueue, blockers,
    still_requires_live_verification: ['Repeat real email delivery verification after changing email configuration or templates', 'Review sandbox lifecycle evidence; repeat after billing changes', 'Portal, payment retries, and tax/refund settings', 'Reviewed frontend deployment with purchases initially disabled'] };
  console.log(JSON.stringify(report, null, 2));
  // Configuration presence alone never certifies a launch. Read the remaining
  // verification requirements even when this command eventually exits zero.
  process.exitCode = blockers.length ? 2 : 0;
} catch {
  console.error('Launch readiness could not be confirmed. No settings were changed and no credentials were printed.');
  process.exitCode = 1;
}
