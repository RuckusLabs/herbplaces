-- Keep previously paying owners editing while Stripe finalizes a cycle invoice.
-- The server supplies the original renewal timestamp, so retries cannot extend
-- this one-day processing window. It never grants access on a first unpaid bill.
begin;
create or replace function place_management_private.subscription_active(p_place_id text) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.place_subscriptions where place_id::text = p_place_id and
    ((status = 'active' and (paid_until > now() or
      (paid_until is not null and not cancel_at_period_end and grace_ends_at > now())))
      or (status = 'past_due' and grace_ends_at > now())))
$$;
create or replace function public.apply_billing_event(p_event_id text, p_event_created bigint, p_place_id text,
  p_customer_id text, p_subscription_id text, p_status text, p_paid_until timestamptz,
  p_failed_at timestamptz, p_cancel_at_period_end boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype; previous public.place_subscriptions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 2));
  if exists(select 1 from public.billing_events where event_id = p_event_id) then return; end if;
  select * into target from public.places where id::text = p_place_id;
  if not found then raise exception 'Unknown billing place.'; end if;
  select * into previous from public.place_subscriptions where place_id = target.id for update;
  if previous.stripe_customer_id is distinct from p_customer_id then raise exception 'Billing customer does not match place.'; end if;
  if previous.last_event_created > p_event_created then
    insert into public.billing_events(event_id) values(p_event_id); return;
  end if;
  if previous.stripe_subscription_id is not null and previous.stripe_subscription_id <> p_subscription_id and previous.status not in ('none','canceled','incomplete_expired')
    then raise exception 'Another subscription is already attached to this place.'; end if;
  update public.place_subscriptions set stripe_subscription_id = p_subscription_id, status = p_status,
    paid_until = p_paid_until,
    grace_ends_at = case
      when p_status = 'past_due' then coalesce(case when previous.status = 'past_due' then previous.grace_ends_at end, coalesce(p_failed_at, now()) + interval '7 days')
      when p_status = 'active' and p_paid_until is not null and p_failed_at is not null and not p_cancel_at_period_end
        then p_failed_at + interval '1 day'
      else null end,
    cancel_at_period_end = p_cancel_at_period_end, last_event_created = p_event_created, updated_at = now()
    where place_id = target.id;
  insert into public.billing_events(event_id) values(p_event_id);
end $$;

commit;
