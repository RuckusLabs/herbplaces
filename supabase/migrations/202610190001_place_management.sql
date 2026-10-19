-- Additive migration for the existing Little Herb Places database.
-- IDs keep their existing native type; RPCs accept their text representation.
begin;

create schema if not exists place_management_private;
revoke all on schema place_management_private from public, anon, authenticated;

-- The existing hosted schema uses bigint for ZIP codes. Text supports blank
-- values, leading zeros, and ZIP+4 without changing place IDs or favorites.
alter table public.places alter column zip type text using zip::text;

alter table public.places
  add column if not exists phone text,
  add column if not exists hours text,
  add column if not exists social_links jsonb not null default '[]',
  add column if not exists category_ids text[],
  add column if not exists photo_alt jsonb not null default '{}',
  add column if not exists content_version bigint not null default 1,
  add column if not exists geocode_status text not null default 'confirmed',
  add column if not exists geocode_attempted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Keep an auth-backed, private user directory; never trust editable profile email.
create table public.management_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  confirmed_at timestamptz,
  created_at timestamptz not null
);
insert into public.management_users
select id, lower(email), email_confirmed_at, created_at from auth.users where email is not null;

do $$
declare id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a where a.attrelid = 'public.places'::regclass and a.attname = 'id';
  if id_type is null then raise exception 'Existing places.id is required'; end if;
  execute format('create table public.place_memberships (
    place_id %s not null references public.places(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    is_billing_contact boolean not null default false,
    created_at timestamptz not null default now(),
    primary key (place_id, user_id))', id_type);
  execute format('create table public.place_invitations (
    id uuid primary key default gen_random_uuid(),
    place_id %s not null references public.places(id) on delete cascade,
    email text not null check (email = lower(btrim(email))),
    is_billing_contact boolean not null default false,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (place_id, email))', id_type);
  execute format('create table public.place_claims (
    id uuid primary key default gen_random_uuid(),
    place_id %s not null references public.places(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    relationship text not null,
    evidence text not null,
    status text not null default ''pending'' check (status in (''pending'', ''approved'', ''rejected'')),
    review_note text not null default '''',
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now())', id_type);
  execute format('create table public.place_subscriptions (
    place_id %s primary key references public.places(id) on delete cascade,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    status text not null default ''none'',
    paid_until timestamptz,
    grace_ends_at timestamptz,
    cancel_at_period_end boolean not null default false,
    checkout_session_id text,
    checkout_expires_at timestamptz,
    checkout_nonce uuid,
    last_event_created bigint not null default 0,
    updated_at timestamptz not null default now())', id_type);
  execute format('create table public.place_revisions (
    id bigint generated always as identity primary key,
    place_id %s not null references public.places(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    version bigint not null,
    content jsonb not null,
    created_at timestamptz not null default now())', id_type);
  execute format('create table public.place_uploads (
    path text primary key,
    place_id %s not null references public.places(id) on delete cascade,
    url text not null unique,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now())', id_type);
end $$;

create unique index one_pending_claim on public.place_claims(place_id, user_id) where status = 'pending';
create unique index one_billing_contact on public.place_memberships(place_id) where is_billing_contact;
create index memberships_by_user on public.place_memberships(user_id);
create index claims_by_user on public.place_claims(user_id);
create index revisions_by_place on public.place_revisions(place_id, version desc);
create index management_user_email on public.management_users(lower(email));
create unique index places_url_slug_unique on public.places("urlSlug") where "urlSlug" is not null;

create table public.management_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  place_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.billing_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

create function place_management_private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.site_admins where user_id = auth.uid())
$$;
create function place_management_private.confirmed_user() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
$$;
create function place_management_private.has_membership(p_place_id text) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.place_memberships where place_id::text = p_place_id and user_id = auth.uid())
$$;
create function place_management_private.subscription_active(p_place_id text) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.place_subscriptions where place_id::text = p_place_id and
    ((status = 'active' and paid_until > now()) or (status = 'past_due' and grace_ends_at > now())))
$$;
create function place_management_private.can_edit(p_place_id text) returns boolean language sql stable security definer
set search_path = '' as $$
  select place_management_private.confirmed_user() and (place_management_private.is_admin() or (place_management_private.has_membership(p_place_id) and place_management_private.subscription_active(p_place_id)))
$$;

-- All private reads/writes go through explicitly authorized RPCs.
do $$ declare t text; begin
  foreach t in array array['site_admins','management_users','place_memberships','place_invitations',
    'place_claims','place_subscriptions','place_revisions','place_uploads','management_audit','billing_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Remove legacy direct listing write access, including any column-level grants.
alter table public.places enable row level security;
revoke all on public.places from public, anon, authenticated;
do $$ declare col text; begin
  for col in select attname from pg_attribute where attrelid = 'public.places'::regclass and attnum > 0 and not attisdropped loop
    execute format('revoke select (%I), insert (%I), update (%I), references (%I) on public.places from public, anon, authenticated', col, col, col, col);
  end loop;
end $$;

-- Keep the currently published beta directory compatible while the new UI is
-- still local. Column grants expose only known public content, never future
-- private columns. All browser writes remain revoked.
do $$ declare col text; begin
  for col in select attname from pg_attribute where attrelid = 'public.places'::regclass and attnum > 0 and not attisdropped
    and attname in ('id','type','isFeatured','isVerified','name','website','address','city','state','zip','description','tagline',
      'coverPhoto','photos','longitude','latitude','featuredProducts','urlSlug','category','categories','phone','hours',
      'social_links','category_ids','photo_alt','content_version','geocode_status','geocode_attempted_at','updated_at') loop
    execute format('grant select (%I) on public.places to anon, authenticated', col);
  end loop;
end $$;
create policy public_place_content_reads on public.places for select to anon, authenticated using (true);

create view public.public_places as
select p.id, p.name, p."urlSlug", p.tagline, p.description, p.website,
  p.address, p.city, p.state, p.zip, p."coverPhoto", p.photos,
  p."isFeatured", (coalesce(p."isVerified", false) or
    (exists(select 1 from public.place_memberships m where m.place_id = p.id) and exists(
      select 1 from public.place_subscriptions s where s.place_id = p.id and
      ((s.status = 'active' and s.paid_until > now()) or (s.status = 'past_due' and s.grace_ends_at > now()))))) as "isVerified",
  case when p.geocode_status = 'confirmed' then p.latitude else null end as latitude,
  case when p.geocode_status = 'confirmed' then p.longitude else null end as longitude,
  p.phone, p.hours, p.social_links, p.category_ids, p.photo_alt,
  to_jsonb(p)->>'category' as category, to_jsonb(p)->>'type' as type, to_jsonb(p)->'categories' as categories,
  p.content_version, p.geocode_status, p.updated_at
from public.places p;
grant select on public.public_places to anon, authenticated;

create function place_management_private.sync_management_user() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if new.email is null then return new; end if;
  insert into public.management_users(user_id, email, confirmed_at, created_at)
    values(new.id, lower(new.email), new.email_confirmed_at, new.created_at)
    on conflict(user_id) do update set email = excluded.email, confirmed_at = excluded.confirmed_at;
  return new;
end $$;
create trigger sync_management_user after insert or update of email, email_confirmed_at on auth.users
for each row execute function place_management_private.sync_management_user();

create function public.activate_place_invitations() returns void language plpgsql security definer
set search_path = '' as $$
declare invitation public.place_invitations%rowtype; current_email text;
begin
  select lower(email) into current_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if current_email is null then raise exception 'Confirm your email before managing a place.'; end if;
  for invitation in select * from public.place_invitations where email = current_email loop
    perform pg_advisory_xact_lock(hashtextextended(invitation.place_id::text, 0));
    select * into invitation from public.place_invitations where id = invitation.id and email = current_email for update;
    if not found then continue; end if;
    if invitation.is_billing_contact then
      update public.place_memberships set is_billing_contact = false where place_id = invitation.place_id;
    end if;
    insert into public.place_memberships(place_id, user_id, is_billing_contact)
      values(invitation.place_id, auth.uid(), invitation.is_billing_contact)
      on conflict(place_id, user_id) do update set is_billing_contact = excluded.is_billing_contact or public.place_memberships.is_billing_contact;
    delete from public.place_invitations where id = invitation.id;
    insert into public.management_audit(actor_id, action, place_id) values(auth.uid(), 'invitation_activated', invitation.place_id::text);
  end loop;
end $$;

create function public.get_management_context() returns jsonb language plpgsql stable security definer
set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before managing a place.'; end if;
  return jsonb_build_object(
    'is_admin', place_management_private.is_admin(),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('place_id', m.place_id::text,
      'is_billing_contact', m.is_billing_contact, 'can_edit', place_management_private.can_edit(m.place_id::text),
      'place', to_jsonb(p), 'subscription', case when s.place_id is null then null else jsonb_build_object(
        'status', s.status, 'paid_until', s.paid_until, 'grace_ends_at', s.grace_ends_at,
        'cancel_at_period_end', s.cancel_at_period_end) end))
      from public.place_memberships m join public.public_places p on p.id = m.place_id
      left join public.place_subscriptions s on s.place_id = m.place_id where m.user_id = auth.uid()), '[]'),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'place_id', c.place_id::text,
      'name', p.name, 'urlSlug', p."urlSlug", 'status', c.status, 'review_note', c.review_note, 'created_at', c.created_at))
      from public.place_claims c join public.places p on p.id = c.place_id where c.user_id = auth.uid()), '[]'));
end $$;

create function public.request_place_claim(p_place_id text, p_relationship text, p_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before requesting a place.'; end if;
  if char_length(btrim(p_relationship)) not between 2 and 200 or char_length(btrim(p_evidence)) not between 10 and 3000
    or p_relationship is null or p_evidence is null then raise exception 'Add your relationship and supporting information.'; end if;
  if place_management_private.has_membership(p_place_id) then raise exception 'You already manage this place.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  if (select count(*) from public.place_claims where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10
    then raise exception 'Please wait before submitting more requests.'; end if;
  insert into public.place_claims(place_id, user_id, relationship, evidence)
    select id, auth.uid(), btrim(p_relationship), btrim(p_evidence) from public.places where id::text = p_place_id;
  if not found then raise exception 'Place not found.'; end if;
end $$;

create function public.admin_assign_manager(p_place_id text, p_email text, p_billing boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid; normalized_email text := lower(btrim(p_email)); target_place public.places%rowtype;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  if normalized_email is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized_email) > 254
    then raise exception 'Enter a valid email address.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  select * into target_place from public.places where id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  select id into target_user from auth.users where lower(email) = normalized_email and email_confirmed_at is not null;
  if p_billing then
    update public.place_invitations set is_billing_contact = false where place_id = target_place.id;
    -- A pending contact does not remove the current contact until they verify their email.
    if target_user is not null then
      update public.place_memberships set is_billing_contact = false where place_id = target_place.id;
    end if;
  end if;
  if target_user is null then
    insert into public.place_invitations(place_id, email, is_billing_contact, created_by)
      values(target_place.id, normalized_email, p_billing, auth.uid())
      on conflict(place_id, email) do update set is_billing_contact = excluded.is_billing_contact;
  else
    insert into public.place_memberships(place_id, user_id, is_billing_contact)
      values(target_place.id, target_user, p_billing)
      on conflict(place_id, user_id) do update set is_billing_contact = excluded.is_billing_contact or public.place_memberships.is_billing_contact;
    delete from public.place_invitations where place_id = target_place.id and email = normalized_email;
  end if;
  insert into public.management_audit(actor_id, action, place_id, details)
    values(auth.uid(), 'manager_assigned', p_place_id, jsonb_build_object('email', normalized_email, 'billing_contact', p_billing));
end $$;

create function public.admin_remove_manager(p_place_id text, p_user_id uuid default null, p_invitation_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  delete from public.place_memberships where place_id::text = p_place_id and user_id = p_user_id;
  delete from public.place_invitations where place_id::text = p_place_id and id = p_invitation_id;
  insert into public.management_audit(actor_id, action, place_id, details)
    values(auth.uid(), 'manager_removed', p_place_id, jsonb_build_object('user_id', p_user_id, 'invitation_id', p_invitation_id));
end $$;

create function public.admin_review_claim(p_claim_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare claim public.place_claims%rowtype; claimant_email text; has_billing boolean;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  select * into claim from public.place_claims where id = p_claim_id for update;
  if not found or claim.status <> 'pending' then raise exception 'This request has already been reviewed.'; end if;
  if p_approve then
    select email into claimant_email from auth.users where id = claim.user_id and email_confirmed_at is not null;
    if claimant_email is null then raise exception 'The claimant must have a confirmed email.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(claim.place_id::text, 0));
    select exists(select 1 from public.place_memberships where place_id = claim.place_id and is_billing_contact) into has_billing;
    perform public.admin_assign_manager(claim.place_id::text, claimant_email, not has_billing);
  end if;
  update public.place_claims set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = left(coalesce(p_note, ''), 3000), reviewed_by = auth.uid(), reviewed_at = now() where id = p_claim_id;
  insert into public.management_audit(actor_id, action, place_id, details)
    values(auth.uid(), 'claim_reviewed', claim.place_id::text, jsonb_build_object('claim_id', p_claim_id, 'approved', p_approve));
end $$;

create function public.admin_directory(p_section text, p_query text default '', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; offset_rows integer := greatest(0, p_page) * 25;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_section = 'users' then
    select jsonb_build_object('total', count(*), 'items', coalesce((select jsonb_agg(to_jsonb(u)) from (
      select user_id, email, confirmed_at, created_at from public.management_users
      where email ilike '%' || left(p_query, 200) || '%' order by email, user_id limit 25 offset offset_rows) u), '[]')) into result
      from public.management_users where email ilike '%' || left(p_query, 200) || '%';
  elsif p_section = 'claims' then
    select jsonb_build_object('total', count(*), 'items', coalesce((select jsonb_agg(to_jsonb(c)) from (
      select c.*, u.email, p.name, p."urlSlug" from public.place_claims c
      join public.management_users u on u.user_id = c.user_id join public.places p on p.id = c.place_id
      where c.status = 'pending' and (u.email ilike '%' || left(p_query, 200) || '%' or p.name ilike '%' || left(p_query, 200) || '%')
      order by c.created_at, c.id limit 25 offset offset_rows) c), '[]')) into result
      from public.place_claims c join public.management_users u on u.user_id = c.user_id join public.places p on p.id = c.place_id
      where c.status = 'pending' and (u.email ilike '%' || left(p_query, 200) || '%' or p.name ilike '%' || left(p_query, 200) || '%');
  elsif p_section in ('places', 'locations') then
    select jsonb_build_object('total', count(*), 'items', coalesce((select jsonb_agg(to_jsonb(p)) from (
      select p.id::text as id, p.name, p."urlSlug", p.city, p.geocode_status, s.status as subscription_status,
        s.grace_ends_at, s.paid_until from public.places p left join public.place_subscriptions s on s.place_id = p.id
      where p.name ilike '%' || left(p_query, 200) || '%' and (p_section <> 'locations' or p.geocode_status <> 'confirmed')
      order by p.name, p.id limit 25 offset offset_rows) p), '[]')) into result
      from public.places p where p.name ilike '%' || left(p_query, 200) || '%' and (p_section <> 'locations' or p.geocode_status <> 'confirmed');
  else raise exception 'Unknown admin section.'; end if;
  return result;
end $$;

create function public.admin_place_detail(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  return jsonb_build_object('place', (select to_jsonb(p) from public.places p where id::text = p_place_id),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'is_billing_contact', m.is_billing_contact))
      from public.place_memberships m join public.management_users u on u.user_id = m.user_id where m.place_id::text = p_place_id), '[]'),
    'invitations', coalesce((select jsonb_agg(to_jsonb(i)) from public.place_invitations i where place_id::text = p_place_id), '[]'),
    'subscription', (select jsonb_build_object('status', s.status, 'paid_until', s.paid_until, 'grace_ends_at', s.grace_ends_at,
      'cancel_at_period_end', s.cancel_at_period_end) from public.place_subscriptions s where place_id::text = p_place_id),
    'revisions', coalesce((select jsonb_agg(to_jsonb(r)) from (select id, version, created_at, actor_id from public.place_revisions
      where place_id::text = p_place_id order by id desc limit 50) r), '[]'),
    'audit', coalesce((select jsonb_agg(to_jsonb(a)) from (select action, details, actor_id, created_at from public.management_audit
      where place_id = p_place_id order by id desc limit 50) a), '[]'));
end $$;

-- Photo URLs may only be kept from the existing gallery/history or uploaded for this place.
create function place_management_private.validate_place_content(p_place_id text, p_content jsonb, p_previous jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare field text; link jsonb; photo text; old_count integer; allowed_count integer; category text; photo_description record;
begin
  if jsonb_typeof(p_content) <> 'object' then raise exception 'Invalid place content.'; end if;
  if p_content is null or not (p_content ?& array['name','social_links','category_ids','photos','coverPhoto','photo_alt'])
    then raise exception 'Incomplete place content.'; end if;
  for field in select jsonb_object_keys(p_content) loop
    if field not in ('name','tagline','description','website','address','city','state','zip','phone','hours',
      'social_links','category_ids','photos','coverPhoto','photo_alt') then raise exception 'That field cannot be edited here: %', field; end if;
  end loop;
  if jsonb_typeof(p_content->'name') <> 'string' or length(btrim(p_content->>'name')) < 1 or length(p_content->>'name') > 200
    then raise exception 'A place name is required (up to 200 characters).'; end if;
  foreach field in array array['tagline','description','website','address','city','state','zip','phone','hours'] loop
    if p_content ? field and (jsonb_typeof(p_content->field) <> 'string' or length(p_content->>field) > case when field = 'description' then 20000 when field = 'hours' then 2000 else 2000 end)
      then raise exception 'Invalid or overly long content for %.', field; end if;
  end loop;
  if coalesce(p_content->>'website', '') <> '' and p_content->>'website' !~* '^https?://[^[:space:]]+$'
    then raise exception 'Use a complete HTTP or HTTPS website URL.'; end if;
  if jsonb_typeof(p_content->'social_links') <> 'array' or jsonb_array_length(p_content->'social_links') > 10
    then raise exception 'Use up to ten social links.'; end if;
  for link in select value from jsonb_array_elements(p_content->'social_links') loop
    if jsonb_typeof(link) <> 'object' or jsonb_typeof(link->'label') is distinct from 'string' or jsonb_typeof(link->'url') is distinct from 'string'
      or coalesce(link->>'label', '') = '' or length(link->>'label') > 80
      or coalesce(link->>'url', '') !~* '^https?://[^[:space:]]+$' or length(link->>'url') > 2000
      then raise exception 'Each social link needs a label and a complete HTTP or HTTPS URL.'; end if;
  end loop;
  if p_content->'category_ids' <> 'null'::jsonb then
    if jsonb_typeof(p_content->'category_ids') <> 'array' or jsonb_array_length(p_content->'category_ids') > 4 then raise exception 'Invalid categories.'; end if;
    for category in select jsonb_array_elements_text(p_content->'category_ids') loop
      if category not in ('shops','herbalists','gardens','workshops') then raise exception 'Unknown category.'; end if;
    end loop;
  end if;
  if jsonb_typeof(p_content->'photos') <> 'array' then raise exception 'Invalid photo gallery.'; end if;
  old_count := case when jsonb_typeof(p_previous->'photos') = 'array' then jsonb_array_length(p_previous->'photos') else 0 end;
  allowed_count := greatest(20, old_count, (select max(jsonb_array_length(content->'photos')) from public.place_revisions
    where place_id::text = p_place_id and jsonb_typeof(content->'photos') = 'array'));
  if jsonb_array_length(p_content->'photos') > allowed_count then raise exception 'Use up to 20 photos.'; end if;
  for photo in select jsonb_array_elements_text(p_content->'photos') loop
    if not (coalesce(p_previous->'photos','[]') @> jsonb_build_array(photo) or photo = p_previous->>'coverPhoto'
      or exists(select 1 from public.place_uploads where place_id::text = p_place_id and url = photo)
      or exists(select 1 from public.place_revisions where place_id::text = p_place_id and
        (content->'photos' @> jsonb_build_array(photo) or content->>'coverPhoto' = photo)))
      then raise exception 'Upload this photo to the place before publishing.'; end if;
  end loop;
  if coalesce(p_content->>'coverPhoto','') <> '' and not (p_content->'photos' @> jsonb_build_array(p_content->>'coverPhoto'))
    then raise exception 'Choose a cover from the gallery.'; end if;
  if jsonb_typeof(p_content->'photo_alt') <> 'object' or octet_length((p_content->'photo_alt')::text) > 20000
    then raise exception 'Invalid photo descriptions.'; end if;
  for photo_description in select key, value from jsonb_each(p_content->'photo_alt') loop
    if jsonb_typeof(photo_description.value) <> 'string' or length(photo_description.value #>> '{}') > 500
      then raise exception 'Photo descriptions must be text, up to 500 characters.'; end if;
  end loop;
end $$;

create function public.publish_place(p_place_id text, p_content jsonb, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.places%rowtype; next_place public.places%rowtype; address_changed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.can_edit(p_place_id) then raise exception 'An approved manager and an active Bloom subscription are required.'; end if;
  select * into previous from public.places where id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or previous.content_version <> p_expected_version then
    raise exception using message = 'Someone else updated this place. Reload the latest version before publishing.', errcode = '40001'; end if;
  perform place_management_private.validate_place_content(p_place_id, p_content, to_jsonb(previous));
  next_place := jsonb_populate_record(previous, p_content);
  address_changed := row(previous.address, previous.city, previous.state, previous.zip) is distinct from row(next_place.address, next_place.city, next_place.state, next_place.zip);
  insert into public.place_revisions(place_id, actor_id, version, content) values(previous.id, auth.uid(), previous.content_version,
    (select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(previous)) where key in
      ('name','tagline','description','website','address','city','state','zip','phone','hours','social_links','category_ids','photos','coverPhoto','photo_alt')));
  update public.places set name = next_place.name, tagline = next_place.tagline, description = next_place.description,
    website = next_place.website, address = next_place.address, city = next_place.city, state = next_place.state,
    zip = next_place.zip, phone = next_place.phone, hours = next_place.hours, social_links = next_place.social_links,
    category_ids = next_place.category_ids, photos = next_place.photos, "coverPhoto" = next_place."coverPhoto", photo_alt = next_place.photo_alt,
    content_version = previous.content_version + 1, updated_at = now(),
    geocode_status = case when address_changed then 'pending' else previous.geocode_status end,
    latitude = case when address_changed then null else previous.latitude end,
    longitude = case when address_changed then null else previous.longitude end
  where id = previous.id;
  insert into public.management_audit(actor_id, action, place_id, details)
    values(auth.uid(), 'place_published', p_place_id, jsonb_build_object('version', previous.content_version + 1));
  return (select to_jsonb(p) from public.public_places p where id = previous.id);
end $$;

create function public.admin_restore_place(p_place_id text, p_revision_id bigint, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb; field text;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  select content into snapshot from public.place_revisions where id = p_revision_id and place_id::text = p_place_id;
  if not found then raise exception 'Revision not found.'; end if;
  foreach field in array array['tagline','description','website','address','city','state','zip','phone','hours','coverPhoto'] loop
    snapshot := jsonb_set(snapshot, array[field], to_jsonb(coalesce(snapshot->>field, '')));
  end loop;
  if jsonb_typeof(snapshot->'photos') is distinct from 'array' then
    snapshot := jsonb_set(snapshot, '{photos}', case when snapshot->>'coverPhoto' <> '' then jsonb_build_array(snapshot->>'coverPhoto') else '[]'::jsonb end);
  end if;
  return public.publish_place(p_place_id, snapshot, p_expected_version);
end $$;

create function public.admin_update_place_settings(p_place_id text, p_slug text, p_verified boolean, p_featured boolean,
  p_latitude double precision, p_longitude double precision, p_expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  perform 1 from public.places where id::text = p_place_id for update;
  if not exists(select 1 from public.places where id::text = p_place_id and content_version = p_expected_version)
    then raise exception 'The place changed. Close and reopen its settings before saving.'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Use a lowercase URL slug with hyphens.'; end if;
  if (p_latitude is null) <> (p_longitude is null) or abs(p_latitude) > 85.051129 or abs(p_longitude) > 180
    then raise exception 'Enter a valid latitude and longitude together.'; end if;
  if exists(select 1 from public.places where "urlSlug" = p_slug and id::text <> p_place_id) then raise exception 'This URL is already in use.'; end if;
  update public.places set "urlSlug" = p_slug, "isVerified" = p_verified, "isFeatured" = p_featured,
    latitude = p_latitude, longitude = p_longitude, geocode_status = case when p_latitude is null then 'review' else 'confirmed' end,
    updated_at = now(), content_version = content_version + 1 where id::text = p_place_id;
  if not found then raise exception 'Place not found.'; end if;
  insert into public.management_audit(actor_id, action, place_id) values(auth.uid(), 'place_settings_updated', p_place_id);
end $$;

create function public.admin_get_revision(p_place_id text, p_revision_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  return (select to_jsonb(r) from public.place_revisions r where place_id::text = p_place_id and id = p_revision_id);
end $$;

create function public.get_editable_place(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.can_edit(p_place_id) then raise exception 'Editing is unavailable. Check your access and subscription.'; end if;
  return (select to_jsonb(p) from public.public_places p where id::text = p_place_id);
end $$;

-- Service-only interfaces for the Edge Functions. Browser RPC access is revoked below.
create function public.management_service_access(p_place_id text, p_user_id uuid, p_billing boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then return null; end if;
  if p_billing then
    if not exists(select 1 from public.place_memberships where place_id::text = p_place_id and user_id = p_user_id and is_billing_contact) then return null; end if;
  elsif not (exists(select 1 from public.site_admins where user_id = p_user_id) or
    (exists(select 1 from public.place_memberships where place_id::text = p_place_id and user_id = p_user_id) and place_management_private.subscription_active(p_place_id))) then return null;
  end if;
  return (select jsonb_build_object('place', to_jsonb(p), 'subscription', (select to_jsonb(s) from public.place_subscriptions s where s.place_id = p.id),
    'billing_email', (select u.email from public.place_memberships m join auth.users u on u.id = m.user_id where m.place_id = p.id and m.is_billing_contact))
    from public.places p where id::text = p_place_id);
end $$;

create function public.register_place_upload(p_place_id text, p_user_id uuid, p_path text, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype;
begin
  if public.management_service_access(p_place_id, p_user_id) is null then raise exception 'Upload access denied.'; end if;
  select * into target from public.places where id::text = p_place_id for update;
  if (select count(*) from public.place_uploads where place_id = target.id and created_at > now() - interval '1 day') >= 100
    then raise exception 'Daily photo upload limit reached.'; end if;
  insert into public.place_uploads(path, place_id, url, created_by) values(p_path, target.id, p_url, p_user_id);
end $$;

create function public.reserve_place_checkout(p_place_id text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype; subscription public.place_subscriptions%rowtype;
begin
  if public.management_service_access(p_place_id, p_user_id, true) is null then raise exception 'Billing contact access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 2));
  select * into target from public.places where id::text = p_place_id for update;
  insert into public.place_subscriptions(place_id) values(target.id) on conflict do nothing;
  select * into subscription from public.place_subscriptions where place_id = target.id for update;
  if subscription.status not in ('none','canceled','incomplete_expired') then raise exception 'Manage the existing subscription in billing.'; end if;
  if subscription.checkout_nonce is null or subscription.checkout_expires_at < now()
    or (subscription.checkout_session_id is null and subscription.checkout_expires_at < now() + interval '31 minutes') then
    update public.place_subscriptions set checkout_nonce = gen_random_uuid(), checkout_session_id = null,
      checkout_expires_at = date_trunc('second', now()) + interval '1 hour'
      where place_id = target.id returning * into subscription;
  end if;
  return to_jsonb(subscription);
end $$;

create function public.apply_place_geocode(p_place_id text, p_address_version bigint, p_latitude double precision, p_longitude double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (p_latitude is null) <> (p_longitude is null) or abs(p_latitude) > 85.051129 or abs(p_longitude) > 180 then raise exception 'Invalid coordinates.'; end if;
  update public.places set latitude = p_latitude, longitude = p_longitude,
    geocode_status = case when p_latitude is null then 'review' else 'confirmed' end
    where id::text = p_place_id and content_version = p_address_version and geocode_status <> 'confirmed';
end $$;

create function public.reserve_place_geocode(p_place_id text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype;
begin
  if public.management_service_access(p_place_id, p_user_id) is null then raise exception 'Editing access required.'; end if;
  update public.places set geocode_attempted_at = now() where id::text = p_place_id and geocode_status <> 'confirmed'
    and (geocode_attempted_at is null or geocode_attempted_at < now() - interval '1 minute') returning * into target;
  if not found then return null; end if;
  return to_jsonb(target);
end $$;

create function public.apply_billing_event(p_event_id text, p_event_created bigint, p_place_id text,
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
    grace_ends_at = case when p_status = 'past_due' then coalesce(previous.grace_ends_at, coalesce(p_failed_at, now()) + interval '7 days') else null end,
    cancel_at_period_end = p_cancel_at_period_end, last_event_created = p_event_created, updated_at = now()
    where place_id = target.id;
  insert into public.billing_events(event_id) values(p_event_id);
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('place-photos', 'place-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Only the authenticated server function may write. Public reads are intentional.
-- Existing permissive Storage policies must not accidentally authorize this bucket.
create policy place_photos_server_writes on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'place-photos') with check (bucket_id <> 'place-photos');

-- PostgreSQL grants new functions to PUBLIC by default: explicitly close that door.
revoke all on all functions in schema place_management_private from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'activate_place_invitations','get_management_context','request_place_claim','admin_assign_manager','admin_remove_manager',
      'admin_review_claim','admin_directory','admin_place_detail','publish_place','admin_restore_place','admin_update_place_settings',
      'get_editable_place','admin_get_revision','management_service_access','register_place_upload','apply_place_geocode','apply_billing_event','reserve_place_checkout','reserve_place_geocode') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    if f.proname in ('management_service_access','register_place_upload','apply_place_geocode','apply_billing_event','reserve_place_checkout','reserve_place_geocode') then
      execute format('grant execute on function %s to service_role', f.signature);
    else
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
  end loop;
end $$;

commit;
