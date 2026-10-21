-- Run after migration 202610210001 and deploying claim-notifications.
-- Enable pg_net and pg_cron first. In Supabase Vault, add:
--   claim_notification_url: https://PROJECT_REF.supabase.co/functions/v1/claim-notifications
--   claim_notification_secret: the same random value as the Edge Function secret
-- Keep secret values out of this file and query history; use the Vault dashboard.
begin;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'claim_notification_url' and decrypted_secret like 'https://%.supabase.co/functions/v1/claim-notifications')
    or not exists(select 1 from vault.decrypted_secrets where name = 'claim_notification_secret' and char_length(decrypted_secret) >= 32)
    then raise exception 'Configure the claim notification URL and a random secret in Vault first.'; end if;
end $$;

create or replace function place_management_private.invoke_claim_notifications() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'claim_notification_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'claim_notification_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
$$;
revoke all on function place_management_private.invoke_claim_notifications() from public, anon, authenticated, service_role;

create or replace function place_management_private.wake_claim_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform place_management_private.invoke_claim_notifications();
  return new;
exception when others then
  -- The durable job remains for the scheduler; the user's claim still succeeds.
  raise warning 'Claim notification dispatch deferred to the retry scheduler.';
  return new;
end $$;
revoke all on function place_management_private.wake_claim_notifications() from public, anon, authenticated, service_role;

drop trigger if exists dispatch_claim_notification on public.place_claim_notifications;
create trigger dispatch_claim_notification after insert on public.place_claim_notifications
  for each row execute function place_management_private.wake_claim_notifications();

drop trigger if exists dispatch_customer_notification on public.place_customer_notifications;
create trigger dispatch_customer_notification after insert on public.place_customer_notifications
  for each row execute function place_management_private.wake_claim_notifications();

-- Using the same job name updates the existing schedule when this script is rerun.
select cron.schedule('claim-notification-retries', '* * * * *',
  'select place_management_private.invoke_claim_notifications();');
commit;
