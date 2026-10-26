begin;
-- Admin review alerts now have their own queue and recipient. Retain historical
-- listing_admin rows as unsent history; customer dispatch must not send them too.
create or replace function public.take_customer_notifications(p_limit integer default 10) returns jsonb
language sql security definer set search_path = '' as $$
  with ready as (
    select id from public.place_customer_notifications where sent_at is null and kind <> 'listing_admin'
      and attempts < 8 and available_at <= now()
      and (first_attempt_at is null or first_attempt_at > now()-interval '23 hours')
    order by available_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,10),10))
  ), leased as (
    update public.place_customer_notifications n set attempts=n.attempts+1,
      first_attempt_at=coalesce(n.first_attempt_at,now()),available_at=now()+interval '5 minutes',lease_token=gen_random_uuid()
    from ready where n.id=ready.id returning n.id,n.kind,n.payload,n.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) from leased
$$;
commit;
