-- Run after the activity email migration and deploying both report functions.
-- Enable pg_net and pg_cron. Configure these in the Vault dashboard first:
-- activity_report_url: https://PROJECT_REF.supabase.co/functions/v1/activity-reports
-- activity_report_secret: same random >=32-character value as ACTIVITY_REPORT_SECRET
-- Server flag ACTIVITY_REPORTS_ENABLED must also be true to send. Preferences default off.
begin;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='activity_report_url' and decrypted_secret like 'https://%.supabase.co/functions/v1/activity-reports')
    or not exists(select 1 from vault.decrypted_secrets where name='activity_report_secret' and length(decrypted_secret)>=32) then
    raise exception 'Configure the activity report URL and scheduler secret in Vault first.';
  end if;
end $$;
create or replace function place_management_private.invoke_activity_reports() returns bigint language sql security definer set search_path='' as $$
 select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='activity_report_url'),
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='activity_report_secret')),
   body:='{}'::jsonb,timeout_milliseconds:=120000)
$$;
revoke all on function place_management_private.invoke_activity_reports() from public,anon,authenticated,service_role;
-- One report per opted-in manager/place/completed month. Frequent wakeups handle
-- delivery batches and bounded retries; they do not create daily report emails.
select cron.schedule('monthly-business-report-retention','53 5 * * *','select public.prune_activity_email_history();');
select cron.schedule('monthly-business-report-delivery','*/5 * * * *','select place_management_private.invoke_activity_reports();');
commit;
