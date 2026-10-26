-- Requires migration 202610260001 and the deployed admin-notifications function.
-- Vault admin_notification_url and admin_notification_secret must be configured.
begin;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'admin_notification_url' and decrypted_secret like 'https://%.supabase.co/functions/v1/admin-notifications')
    or not exists(select 1 from vault.decrypted_secrets where name = 'admin_notification_secret' and char_length(decrypted_secret) >= 32)
    then raise exception 'Configure the admin notification URL and secret in Vault first.'; end if;
end $$;
create or replace function place_management_private.invoke_admin_notifications() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'admin_notification_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'admin_notification_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$;
revoke all on function place_management_private.invoke_admin_notifications() from public, anon, authenticated, service_role;
select cron.schedule('admin-notification-retries', '* * * * *', 'select place_management_private.invoke_admin_notifications();');
commit;
