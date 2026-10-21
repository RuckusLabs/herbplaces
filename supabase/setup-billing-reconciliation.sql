-- Run after deploying billing-reconcile. Enable pg_net and pg_cron first.
-- Add through Supabase Vault, never through a committed SQL value:
--   billing_reconcile_url: https://PROJECT_REF.supabase.co/functions/v1/billing-reconcile
--   billing_reconcile_secret: the same random value as BILLING_RECONCILE_SECRET
begin;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='billing_reconcile_url' and decrypted_secret like 'https://%.supabase.co/functions/v1/billing-reconcile')
    or not exists(select 1 from vault.decrypted_secrets where name='billing_reconcile_secret' and char_length(decrypted_secret)>=32) then
    raise exception 'Configure the billing reconciliation URL and a random secret in Vault first.';
  end if;
end $$;
create or replace function place_management_private.invoke_billing_reconciliation() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='billing_reconcile_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='billing_reconcile_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  )
$$;
revoke all on function place_management_private.invoke_billing_reconciliation() from public,anon,authenticated,service_role;
select cron.schedule('bloom-billing-reconciliation','7 * * * *','select place_management_private.invoke_billing_reconciliation();');
commit;
