begin;

create function public.admin_attention_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  return jsonb_build_object(
    'claims', (select count(*) from public.place_claims where status = 'pending'),
    'listing-requests', (select count(*) from public.place_listing_requests where status = 'pending'),
    'locations', (select count(*) from public.places where geocode_status <> 'confirmed'));
end $$;
revoke all on function public.admin_attention_counts() from public, anon, authenticated, service_role;
grant execute on function public.admin_attention_counts() to authenticated;

-- Only events after this migration enter this queue. Existing customer/admin
-- queues stay paused; no historical request is reclassified as newly submitted.
create table public.place_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('claims','listing-requests','locations')),
  reference text not null,
  dedupe_key text not null unique,
  place_name text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  email_id text,
  created_at timestamptz not null default now()
);
alter table public.place_admin_notifications enable row level security;
revoke all on public.place_admin_notifications from public, anon, authenticated, service_role;
create index ready_admin_notifications on public.place_admin_notifications(available_at) where sent_at is null;

create function place_management_private.queue_admin_attention() returns trigger
language plpgsql security definer set search_path = '' as $$
declare title text; event_kind text; event_key text;
begin
  if tg_table_name = 'place_claims' then
    if new.status <> 'pending' then return new; end if;
    select name into title from public.places where id = new.place_id;
    event_kind := 'claims'; event_key := new.id::text;
  elsif tg_table_name = 'place_listing_requests' then
    if new.status <> 'pending' then return new; end if;
    title := new.name; event_kind := 'listing-requests'; event_key := new.id::text;
  else
    if new.geocode_status = 'confirmed' then return new; end if;
    if tg_op = 'UPDATE' and old.geocode_status <> 'confirmed' then return new; end if;
    title := new.name; event_kind := 'locations'; event_key := new.id::text || '/' || new.content_version::text;
  end if;
  insert into public.place_admin_notifications(kind, reference, dedupe_key, place_name)
    values(event_kind, new.id::text, event_kind || '/' || event_key, coalesce(title, 'A place'))
    on conflict(dedupe_key) do nothing;
  return new;
end $$;
revoke all on function place_management_private.queue_admin_attention() from public, anon, authenticated, service_role;
create trigger queue_admin_claim after insert on public.place_claims for each row execute function place_management_private.queue_admin_attention();
create trigger queue_admin_listing after insert on public.place_listing_requests for each row execute function place_management_private.queue_admin_attention();
create trigger queue_admin_location after insert or update of geocode_status, content_version on public.places for each row execute function place_management_private.queue_admin_attention();

create function public.take_admin_notifications(p_limit integer default 10) returns jsonb
language sql security definer set search_path = '' as $$
  with ready as (
    select n.id from public.place_admin_notifications n
    where n.sent_at is null and n.attempts < 8 and n.available_at <= now()
      and (n.first_attempt_at is null or n.first_attempt_at > now() - interval '23 hours')
      and ((n.kind = 'claims' and exists(select 1 from public.place_claims c where c.id::text = n.reference and c.status = 'pending'))
        or (n.kind = 'listing-requests' and exists(select 1 from public.place_listing_requests r where r.id::text = n.reference and r.status = 'pending'))
        or (n.kind = 'locations' and exists(select 1 from public.places p where p.id::text = n.reference and p.geocode_status <> 'confirmed')))
    order by n.available_at, n.id for update skip locked limit greatest(1, least(coalesce(p_limit, 10), 10))
  ), leased as (
    update public.place_admin_notifications n set attempts = n.attempts + 1,
      first_attempt_at = coalesce(n.first_attempt_at, now()), available_at = now() + interval '5 minutes', lease_token = gen_random_uuid()
    from ready where n.id = ready.id returning n.id, n.kind, n.place_name, n.created_at, n.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(leased)), '[]'::jsonb) from leased
$$;
create function public.finish_admin_notification(p_id uuid, p_lease_token uuid, p_email_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.place_admin_notifications set sent_at = case when nullif(p_email_id, '') is not null then now() else null end,
    email_id = nullif(p_email_id, ''), lease_token = null
    where id = p_id and lease_token = p_lease_token and sent_at is null;
  if not found then raise exception 'Notification lease is no longer valid.'; end if;
end $$;
revoke all on function public.take_admin_notifications(integer) from public, anon, authenticated;
revoke all on function public.finish_admin_notification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.take_admin_notifications(integer) to service_role;
grant execute on function public.finish_admin_notification(uuid, uuid, text) to service_role;
commit;
