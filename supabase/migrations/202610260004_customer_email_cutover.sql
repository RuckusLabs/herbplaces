begin;

-- Suppression is distinct from delivery. Retain an honest receipt for messages
-- intentionally retired during setup; never mark them sent to clear a backlog.
alter table public.place_customer_notifications
  add column suppressed_at timestamptz,
  add column suppression_reason text,
  add constraint customer_notification_suppression check
    ((suppressed_at is null and suppression_reason is null)
      or (suppressed_at is not null and nullif(trim(suppression_reason),'') is not null and sent_at is null));

update public.place_customer_notifications set suppressed_at=now(),
  suppression_reason='Retired admin delivery route; dedicated admin alerts own new reviews.', lease_token=null
  where kind='listing_admin' and sent_at is null;

create or replace function place_management_private.queue_listing_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare message_kind text; details jsonb;
begin
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  message_kind := case when tg_op = 'INSERT' then 'listing_received' else 'listing_reviewed' end;
  select jsonb_build_object('account_email', u.email, 'place_name', new.name, 'city', new.city,
    'region', new.region, 'website', new.website, 'notes', new.notes,
    'place_slug', new.place_slug, 'status', new.status, 'review_note', new.review_note) into details
    from auth.users u where u.id = new.user_id;
  insert into public.place_customer_notifications(user_id, request_id, kind, dedupe_key, payload)
    values(new.user_id, new.id, message_kind, new.id::text || '/' || message_kind, details)
    on conflict(dedupe_key) do nothing;
  return new;
end $$;

create or replace function public.take_customer_notifications(p_limit integer default 10) returns jsonb
language sql security definer set search_path = '' as $$
  with ready as (
    select n.id,u.email from public.place_customer_notifications n join auth.users u on u.id=n.user_id
    where n.sent_at is null and n.suppressed_at is null and n.kind <> 'listing_admin'
      and u.email_confirmed_at is not null and nullif(u.email,'') is not null
      and n.attempts < 8 and n.available_at <= now()
      and (n.first_attempt_at is null or n.first_attempt_at > now()-interval '23 hours')
    order by n.available_at,n.id for update of n skip locked limit greatest(1,least(coalesce(p_limit,10),10))
  ), leased as (
    update public.place_customer_notifications n set attempts=n.attempts+1,
      first_attempt_at=coalesce(n.first_attempt_at,now()),available_at=now()+interval '5 minutes',lease_token=gen_random_uuid(),
      payload=jsonb_set(n.payload,'{account_email}',to_jsonb(ready.email))
    from ready where n.id=ready.id returning n.id,n.kind,n.payload,n.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) from leased
$$;

create or replace function public.finish_customer_notification(p_id uuid, p_lease_token uuid, p_email_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.place_customer_notifications set sent_at=case when nullif(p_email_id,'') is not null then now() else null end,
    email_id=nullif(p_email_id,''),lease_token=null
    where id=p_id and lease_token=p_lease_token and sent_at is null and suppressed_at is null;
  if not found then raise exception 'Notification lease is no longer valid.'; end if;
end $$;

drop index public.unsent_customer_notifications;
create index unsent_customer_notifications on public.place_customer_notifications(available_at)
  where sent_at is null and suppressed_at is null;
commit;
