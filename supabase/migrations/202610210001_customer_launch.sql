begin;

-- Verification records an approved business relationship, independently of billing.
-- Existing editorial verification is retained. No manager identities become public.
create or replace view public.public_places as
select p.id, p.name, p."urlSlug", p.tagline, p.description, p.website,
  p.address, p.city, p.state, p.zip, p."coverPhoto", p.photos,
  p."isFeatured", (coalesce(p."isVerified", false) or exists(
    select 1 from public.place_memberships m where m.place_id = p.id)) as "isVerified",
  case when p.geocode_status = 'confirmed' then p.latitude else null end as latitude,
  case when p.geocode_status = 'confirmed' then p.longitude else null end as longitude,
  p.phone, p.hours, p.social_links, p.category_ids, p.photo_alt,
  to_jsonb(p)->>'category' as category, to_jsonb(p)->>'type' as type, to_jsonb(p)->'categories' as categories,
  p.content_version, p.geocode_status, p.updated_at,
  (exists(select 1 from public.place_memberships m where m.place_id = p.id)
    or exists(select 1 from public.place_invitations i where i.place_id = p.id)) as is_claimed
from public.places p;

create table public.place_listing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 200),
  website text not null default '',
  city text not null check (char_length(city) between 1 and 200),
  region text not null default '' check (char_length(region) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'pending' check (status in ('pending','listed','declined')),
  place_slug text,
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index one_pending_listing_request on public.place_listing_requests(user_id, lower(name), lower(city)) where status = 'pending';
alter table public.place_listing_requests enable row level security;
revoke all on public.place_listing_requests from public, anon, authenticated, service_role;

-- Private customer messages have their own queue so the existing admin claim
-- queue and delivery idempotency keys remain compatible during rollout.
create table public.place_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid references public.place_claims(id) on delete cascade,
  request_id uuid references public.place_listing_requests(id) on delete cascade,
  kind text not null check (kind in ('claim_received','claim_approved','claim_rejected','listing_received','listing_reviewed','listing_admin')),
  payload jsonb not null,
  dedupe_key text not null unique,
  attempts integer not null default 0,
  available_at timestamptz not null default now(), lease_token uuid,
  first_attempt_at timestamptz, sent_at timestamptz, email_id text,
  created_at timestamptz not null default now()
);
alter table public.place_customer_notifications enable row level security;
revoke all on public.place_customer_notifications from public, anon, authenticated, service_role;
create index unsent_customer_notifications on public.place_customer_notifications(available_at) where sent_at is null;

create function place_management_private.queue_customer_claim_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare message_kind text;
begin
  if tg_op = 'INSERT' then message_kind := 'claim_received';
  elsif old.status = new.status or new.status not in ('approved','rejected') then return new;
  else message_kind := 'claim_' || new.status; end if;
  insert into public.place_customer_notifications(user_id, claim_id, kind, dedupe_key, payload)
    select new.user_id, new.id, message_kind, new.id::text || '/' || message_kind,
      jsonb_build_object('account_email', u.email, 'place_name', p.name, 'place_slug', p."urlSlug",
        'review_note', case when message_kind = 'claim_received' then '' else new.review_note end)
    from auth.users u join public.places p on p.id = new.place_id where u.id = new.user_id
    on conflict(dedupe_key) do nothing;
  return new;
end $$;
revoke all on function place_management_private.queue_customer_claim_notification() from public, anon, authenticated, service_role;
create trigger queue_customer_claim_notification after insert or update of status on public.place_claims
  for each row execute function place_management_private.queue_customer_claim_notification();

create function place_management_private.queue_listing_notification() returns trigger
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
  if tg_op = 'INSERT' then
    insert into public.place_customer_notifications(user_id, request_id, kind, dedupe_key, payload)
      values(new.user_id, new.id, 'listing_admin', new.id::text || '/listing_admin', details);
  end if;
  return new;
end $$;
revoke all on function place_management_private.queue_listing_notification() from public, anon, authenticated, service_role;
create trigger queue_listing_notification after insert or update of status on public.place_listing_requests
  for each row execute function place_management_private.queue_listing_notification();

create function public.request_place_listing(p_name text, p_website text, p_city text, p_region text, p_notes text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.place_listing_requests%rowtype; result uuid;
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before requesting a listing.'; end if;
  if p_request_id is null or p_name is null or p_city is null or char_length(btrim(p_name)) not between 2 and 200
    or char_length(btrim(p_city)) not between 1 and 200 or char_length(coalesce(p_region,'')) > 200
    or char_length(coalesce(p_notes,'')) > 2000 or char_length(coalesce(p_website,'')) > 2000
    or (coalesce(p_website,'') <> '' and p_website !~* '^https?://[^[:space:]]+$') then
    raise exception 'Add a place name, city, and a valid website starting with https:// if provided.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  select * into existing from public.place_listing_requests where id = p_request_id;
  if found then
    if existing.user_id <> auth.uid() then raise exception 'Request reference is unavailable.'; end if;
    return existing.id;
  end if;
  select id into result from public.place_listing_requests where user_id = auth.uid() and status = 'pending'
    and lower(name) = lower(btrim(p_name)) and lower(city) = lower(btrim(p_city));
  if result is not null then return result; end if;
  if (select count(*) from public.place_listing_requests where user_id = auth.uid() and created_at > now()-interval '1 day') >= 5
    then raise exception 'Please wait before submitting more listing requests.'; end if;
  insert into public.place_listing_requests(id,user_id,name,website,city,region,notes)
    values(p_request_id,auth.uid(),btrim(p_name),coalesce(p_website,''),btrim(p_city),btrim(coalesce(p_region,'')),btrim(coalesce(p_notes,''))) returning id into result;
  return result;
end $$;

create function public.get_listing_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before viewing listing requests.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'city',r.city,'status',r.status,
    'place_slug',r.place_slug,'review_note',r.review_note,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
    from public.place_listing_requests r where r.user_id = auth.uid());
end $$;

create function public.admin_listing_requests(p_query text default '', p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; total bigint;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  select count(*) into total from public.place_listing_requests r where r.status = 'pending'
    and (r.name ilike '%' || left(coalesce(p_query,''),200) || '%' or r.city ilike '%' || left(coalesce(p_query,''),200) || '%');
  select coalesce(jsonb_agg(to_jsonb(items)), '[]'::jsonb) into result from (
    select r.id,r.name,r.website,r.city,r.region,r.notes,r.created_at,u.email
    from public.place_listing_requests r join auth.users u on u.id = r.user_id where r.status = 'pending'
      and (r.name ilike '%' || left(coalesce(p_query,''),200) || '%' or r.city ilike '%' || left(coalesce(p_query,''),200) || '%')
    order by r.created_at,r.id limit 25 offset greatest(0,least(coalesce(p_page,0),10000))*25
  ) items;
  return jsonb_build_object('items',result,'total',total);
end $$;

create function public.admin_review_listing_request(p_request_id uuid, p_slug text default null, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare target public.place_listing_requests%rowtype; listing_slug text;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  select * into target from public.place_listing_requests where id = p_request_id for update;
  if not found or target.status <> 'pending' then raise exception 'This listing request has already been reviewed.'; end if;
  if nullif(btrim(p_slug),'') is not null then
    select p."urlSlug" into listing_slug from public.places p where p."urlSlug" = btrim(p_slug);
    if listing_slug is null then raise exception 'Create or find the listing first, then enter its URL slug.'; end if;
  elsif char_length(btrim(coalesce(p_note,''))) < 10 then raise exception 'Add a review note explaining why the listing was declined.';
  end if;
  update public.place_listing_requests set status = case when listing_slug is null then 'declined' else 'listed' end,
    place_slug = listing_slug, review_note = left(coalesce(p_note,''),3000), reviewed_by = auth.uid(), reviewed_at = now() where id = target.id;
  insert into public.management_audit(actor_id,action,details)
    values(auth.uid(),'listing_request_reviewed',jsonb_build_object('request_id',target.id,'place_slug',listing_slug));
end $$;

create function public.take_customer_notifications(p_limit integer default 10) returns jsonb
language sql security definer set search_path = '' as $$
  with ready as (
    select id from public.place_customer_notifications where sent_at is null and attempts < 8 and available_at <= now()
      and (first_attempt_at is null or first_attempt_at > now()-interval '23 hours')
    order by available_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,10),10))
  ), leased as (
    update public.place_customer_notifications n set attempts=n.attempts+1,
      first_attempt_at=coalesce(n.first_attempt_at,now()),available_at=now()+interval '5 minutes',lease_token=gen_random_uuid()
    from ready where n.id=ready.id returning n.id,n.kind,n.payload,n.lease_token
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) from leased
$$;
create function public.finish_customer_notification(p_id uuid, p_lease_token uuid, p_email_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.place_customer_notifications set sent_at=case when nullif(p_email_id,'') is not null then now() else null end,
    email_id=nullif(p_email_id,''),lease_token=null where id=p_id and lease_token=p_lease_token and sent_at is null;
  if not found then raise exception 'Notification lease is no longer valid.'; end if;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('request_place_listing','get_listing_requests','admin_listing_requests',
      'admin_review_listing_request','take_customer_notifications','finish_customer_notification') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname in ('take_customer_notifications','finish_customer_notification') then
      execute format('grant execute on function %s to service_role',f.signature);
    else execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
commit;
