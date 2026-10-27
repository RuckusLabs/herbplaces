-- Additive growth tools. Stripe subscriptions and existing billing remain unchanged.
begin;
do $$ declare id_type text; begin
  select format_type(atttypid, atttypmod) into id_type from pg_attribute where attrelid = 'public.places'::regclass and attname = 'id';
  execute format('create table public.place_growth_profiles (
    place_id %s primary key references public.places(id) on delete cascade,
    content jsonb not null default ''{}'', version bigint not null default 1,
    operating_status text not null default ''open'' check (operating_status in (''open'',''temporarily_closed'',''permanently_closed'')),
    updated_at timestamptz not null default now())', id_type);
  execute format('create table public.place_growth_pilots (
    place_id %s primary key references public.places(id) on delete cascade,
    expires_at timestamptz not null, granted_by uuid references auth.users(id) on delete set null)', id_type);
  execute format('create table public.place_activity (
    event_id uuid primary key, place_id %s not null references public.places(id) on delete cascade,
    kind text not null check (kind in (''profile_view'',''website_click'',''directions_click'',''phone_click'',''primary_click'',''announcement_click'',''offering_click'',''event_click'')),
    item_id uuid, visitor_hash text not null, created_at timestamptz not null default now())', id_type);
end $$;
create index place_activity_by_place on public.place_activity(place_id, created_at);
create index place_activity_rate on public.place_activity(visitor_hash, created_at);
create index place_activity_retention on public.place_activity(created_at);
create table public.place_growth_revisions (
  id bigint generated always as identity primary key, place_id text not null,
  actor_id uuid references auth.users(id) on delete set null, version bigint not null,
  content jsonb not null, created_at timestamptz not null default now()
);
-- Revisions use text IDs for portability; explicit cleanup follows parent deletion.
create function place_management_private.cleanup_growth_revisions() returns trigger language plpgsql security definer set search_path = '' as $$
begin delete from public.place_growth_revisions where place_id = old.id::text; return old; end $$;
create trigger cleanup_growth_revisions after delete on public.places for each row execute function place_management_private.cleanup_growth_revisions();
do $$ declare t text; begin
  foreach t in array array['place_growth_profiles','place_growth_pilots','place_activity','place_growth_revisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
create view public.public_place_growth as
select g.place_id::text as place_id, p."urlSlug" as place_slug, g.content, g.version, g.operating_status, g.updated_at
from public.place_growth_profiles g join public.places p on p.id = g.place_id;
grant select on public.public_place_growth to anon, authenticated;

create function place_management_private.thrive_pilot_active(p_place_id text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.place_growth_pilots where place_id::text = p_place_id and expires_at > now())
$$;
create function place_management_private.can_edit_growth(p_place_id text) returns boolean language sql stable security definer set search_path = '' as $$
  select place_management_private.confirmed_user() and (place_management_private.is_admin() or
    (place_management_private.has_membership(p_place_id) and (place_management_private.subscription_active(p_place_id) or place_management_private.thrive_pilot_active(p_place_id))))
$$;
create or replace function place_management_private.can_edit(p_place_id text) returns boolean language sql stable security definer set search_path = '' as $$ select place_management_private.can_edit_growth(p_place_id) $$;
create function public.get_growth_access(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not (place_management_private.has_membership(p_place_id) or place_management_private.is_admin()) then raise exception 'Approved manager access required.'; end if;
  return jsonb_build_object('can_edit', place_management_private.can_edit_growth(p_place_id),
    'can_thrive', place_management_private.is_admin() or place_management_private.thrive_pilot_active(p_place_id),
    'pilot_until', (select expires_at from public.place_growth_pilots where place_id::text = p_place_id),
    'profile', coalesce((select to_jsonb(g) from public.public_place_growth g where place_id = p_place_id), jsonb_build_object('version',1,'content','{}'::jsonb,'operating_status','open')));
end $$;
create function public.admin_set_thrive_pilot(p_place_id text, p_expires_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_expires_at is null then delete from public.place_growth_pilots where place_id::text = p_place_id;
  else
    if p_expires_at <= now() or p_expires_at > now() + interval '90 days' then raise exception 'Choose a pilot end within the next 90 days.'; end if;
    insert into public.place_growth_pilots(place_id, expires_at, granted_by) select id, p_expires_at, auth.uid() from public.places where id::text = p_place_id
      on conflict(place_id) do update set expires_at = excluded.expires_at, granted_by = excluded.granted_by;
    if not found then raise exception 'Place not found.'; end if;
  end if;
  insert into public.management_audit(actor_id, action, place_id, details) values(auth.uid(), 'thrive_pilot_updated', p_place_id, jsonb_build_object('expires_at',p_expires_at));
end $$;

create function place_management_private.valid_growth_url(p_url text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_url, '') = '' or (length(p_url) <= 2000 and p_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$')
$$;
create function place_management_private.validate_growth(p_content jsonb, p_place_id text) returns void language plpgsql security definer set search_path = '' as $$
declare field text; item jsonb; a jsonb; image text; item_id text; seen_ids text[] := '{}'; event_mode boolean; starts timestamptz; ends timestamptz;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 100000
    or not (p_content ?& array['primary_action','specialties','languages','access_notes','announcement','offerings','events']) then raise exception 'Incomplete business highlights.'; end if;
  for field in select jsonb_object_keys(p_content) loop
    if field not in ('primary_action','specialties','languages','access_notes','announcement','offerings','events') then raise exception 'Unknown business highlights field.'; end if;
  end loop;
  if jsonb_typeof(p_content->'languages') is distinct from 'string' or length(p_content->>'languages') > 200 or jsonb_typeof(p_content->'access_notes') is distinct from 'string' or length(p_content->>'access_notes') > 1000 then raise exception 'Use short language and access details.'; end if;
  if jsonb_typeof(p_content->'specialties') is distinct from 'array' or jsonb_array_length(p_content->'specialties') > 10 then raise exception 'Invalid specialties.'; end if;
  for item in select value from jsonb_array_elements(p_content->'specialties') loop
    if jsonb_typeof(item) <> 'string' or item #>> '{}' not in ('Bulk herbs','Custom blends','Herbal consultations','Workshops','Tea','Body care','Plants & seeds','Online shopping','Shipping','Local pickup') then raise exception 'Unknown specialty.'; end if;
  end loop;
  a := p_content->'primary_action';
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'url') is distinct from 'string' or jsonb_typeof(a->'label') is distinct from 'string' or not place_management_private.valid_growth_url(a->>'url') or
    (a->>'url' <> '' and a->>'label' not in ('Book a consultation','Shop online','See upcoming classes','Contact us')) then raise exception 'Choose a valid main action and link.'; end if;
  a := p_content->'announcement';
  if jsonb_typeof(a) is distinct from 'object' then raise exception 'Invalid announcement.'; end if;
  foreach field in array array['title','body','url','code','starts_at','expires_at'] loop
    if jsonb_typeof(a->field) is distinct from 'string' or length(a->>field) > (case field when 'title' then 120 when 'body' then 1000 when 'code' then 40 when 'url' then 2000 else 80 end) then raise exception 'Invalid announcement details.'; end if;
  end loop;
  if not place_management_private.valid_growth_url(a->>'url') then raise exception 'Invalid announcement link.'; end if;
  starts := nullif(a->>'starts_at','')::timestamptz; ends := nullif(a->>'expires_at','')::timestamptz;
  if a->>'title' <> '' and (ends is null or (starts is not null and ends <= starts)) then raise exception 'An announcement needs a valid expiry after its start.'; end if;
  foreach field in array array['offerings','events'] loop
    event_mode := field = 'events';
    if jsonb_typeof(p_content->field) is distinct from 'array' or jsonb_array_length(p_content->field) > 10 then raise exception 'Use up to 10 offerings and 10 events.'; end if;
    for item in select value from jsonb_array_elements(p_content->field) loop
      if jsonb_typeof(item) <> 'object' then raise exception 'Invalid showcase item.'; end if;
      item_id := item->>'id';
      if item_id is null or item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or item_id = any(seen_ids) then raise exception 'Each item needs a unique identifier.'; end if;
      seen_ids := array_append(seen_ids, item_id);
      if jsonb_typeof(item->'title') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 120 or jsonb_typeof(item->'description') is distinct from 'string' or length(item->>'description') > 1500 or jsonb_typeof(item->'price') is distinct from 'string' or length(item->>'price') > 100 then raise exception 'Invalid item title, description, or price.'; end if;
      if jsonb_typeof(item->'url') is distinct from 'string' or coalesce(item->>'url','') = '' or not place_management_private.valid_growth_url(item->>'url') then raise exception 'Each item needs a valid destination link.'; end if;
      image := item->>'image';
      if jsonb_typeof(item->'image') is distinct from 'string' or jsonb_typeof(item->'image_alt') is distinct from 'string' or length(item->>'image_alt') > 300 then raise exception 'Invalid item photo description.'; end if;
      if image <> '' and not exists(select 1 from public.places p where p.id::text = p_place_id and (to_jsonb(p.photos) @> jsonb_build_array(image) or p."coverPhoto" = image)) then raise exception 'Choose an existing listing photo.'; end if;
      if event_mode then
        if jsonb_typeof(item->'starts_at') is distinct from 'string' or jsonb_typeof(item->'ends_at') is distinct from 'string' or jsonb_typeof(item->'location') is distinct from 'string' or length(item->>'location') > 300 or jsonb_typeof(item->'timezone') is distinct from 'string' or not exists(select 1 from pg_timezone_names where name = item->>'timezone') then raise exception 'Add valid event dates, location, and time zone.'; end if;
        starts := nullif(item->>'starts_at','')::timestamptz; ends := nullif(item->>'ends_at','')::timestamptz;
        if starts is null or ends is null or ends <= starts then raise exception 'Events must end after they start.'; end if;
      elsif coalesce(item->>'kind','') not in ('product','service') then raise exception 'Choose product or service.'; end if;
    end loop;
  end loop;
end $$;

create function public.publish_place_growth(p_place_id text, p_content jsonb, p_expected_version bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.place_growth_profiles%rowtype; begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.can_edit_growth(p_place_id) then raise exception 'Bloom or an active Thrive pilot is required to edit highlights.'; end if;
  insert into public.place_growth_profiles(place_id) select id from public.places where id::text = p_place_id on conflict do nothing;
  select * into previous from public.place_growth_profiles where place_id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or p_expected_version <> previous.version then raise exception using message = 'Someone updated these highlights. Reload before publishing.', errcode = 'PT409'; end if;
  perform place_management_private.validate_growth(p_content, p_place_id);
  if not (place_management_private.is_admin() or place_management_private.thrive_pilot_active(p_place_id)) and
    (coalesce(p_content->'offerings','[]') <> coalesce(previous.content->'offerings','[]') or coalesce(p_content->'events','[]') <> coalesce(previous.content->'events','[]')) then raise exception 'An active Thrive pilot is required to change offerings or events.'; end if;
  insert into public.place_growth_revisions(place_id, actor_id, version, content) values(p_place_id, auth.uid(), previous.version, previous.content);
  update public.place_growth_profiles set content = p_content, version = version + 1, updated_at = now() where place_id::text = p_place_id;
  insert into public.management_audit(actor_id, action, place_id) values(auth.uid(),'business_highlights_published',p_place_id);
  return (select to_jsonb(g) from public.public_place_growth g where place_id = p_place_id);
end $$;

-- Approved managers may correct essential public information without subscribing.
create function public.update_place_essentials(p_place_id text, p_content jsonb, p_expected_version bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.places%rowtype; next_place public.places%rowtype; field text; status text; moved boolean; begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.confirmed_user() or not (place_management_private.has_membership(p_place_id) or place_management_private.is_admin()) then raise exception 'Approved manager access required.'; end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then raise exception 'Invalid essential details.'; end if;
  for field in select jsonb_object_keys(p_content) loop
    if field not in ('address','city','state','zip','phone','hours','operating_status') or jsonb_typeof(p_content->field) <> 'string' or length(p_content->>field) > 2000 then raise exception 'Only essential visit information can be corrected here.'; end if;
  end loop;
  status := p_content->>'operating_status';
  if coalesce(status,'') not in ('open','temporarily_closed','permanently_closed') then raise exception 'Choose an operating status.'; end if;
  select * into previous from public.places where id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or p_expected_version <> previous.content_version then raise exception using message = 'This listing changed. Reload before saving.', errcode = 'PT409'; end if;
  next_place := jsonb_populate_record(previous, p_content - 'operating_status');
  moved := row(previous.address,previous.city,previous.state,previous.zip) is distinct from row(next_place.address,next_place.city,next_place.state,next_place.zip);
  insert into public.place_revisions(place_id,actor_id,version,content) values(previous.id,auth.uid(),previous.content_version,
    (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(previous)) where key in ('name','tagline','description','website','address','city','state','zip','phone','hours','social_links','category_ids','photos','coverPhoto','photo_alt')));
  update public.places set address=next_place.address,city=next_place.city,state=next_place.state,zip=next_place.zip,phone=next_place.phone,hours=next_place.hours,
    content_version=content_version+1,updated_at=now(),geocode_status=case when moved then 'pending' else previous.geocode_status end,
    latitude=case when moved then null else previous.latitude end,longitude=case when moved then null else previous.longitude end where id=previous.id;
  insert into public.place_growth_profiles(place_id,operating_status) values(previous.id,status)
    on conflict(place_id) do update set operating_status=excluded.operating_status,version=public.place_growth_profiles.version+1,updated_at=now();
  insert into public.management_audit(actor_id,action,place_id) values(auth.uid(),'essential_details_corrected',p_place_id);
  return (select to_jsonb(p) from public.public_places p where id=previous.id);
end $$;

-- Only the Edge Function may record public actions. It supplies an HMAC of the
-- request IP + UTC date, never an IP, URL, email, or persistent visitor ID.
create function public.record_place_activity(p_place_id text, p_kind text, p_item_id uuid, p_event_id uuid, p_visitor_hash text) returns boolean language plpgsql security definer set search_path = '' as $$
declare content jsonb; item jsonb; begin
  if coalesce(p_visitor_hash,'') !~ '^[0-9a-f]{64}$' or p_event_id is null or p_kind not in ('profile_view','website_click','directions_click','phone_click','primary_click','announcement_click','offering_click','event_click') then return false; end if;
  if not exists(select 1 from public.places where id::text=p_place_id) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_hash,7));
  if (select count(*) from public.place_activity where visitor_hash=p_visitor_hash and created_at > now()-interval '1 day') >= 1000 then return false; end if;
  if exists(select 1 from public.place_activity where visitor_hash=p_visitor_hash and place_id::text=p_place_id and kind=p_kind and item_id is not distinct from p_item_id and created_at>now()-(case when p_kind='profile_view' then interval '30 minutes' else interval '5 seconds' end)) then return false; end if;
  select g.content into content from public.place_growth_profiles g where place_id::text=p_place_id;
  if p_kind='primary_click' and coalesce(content->'primary_action'->>'url','')='' then return false; end if;
  if p_kind='announcement_click' and (coalesce(content->'announcement'->>'url','')='' or coalesce(nullif(content->'announcement'->>'expires_at','')::timestamptz,'epoch')<=now() or coalesce(nullif(content->'announcement'->>'starts_at','')::timestamptz,'epoch')>now()) then return false; end if;
  if p_kind in ('offering_click','event_click') then
    select value into item from jsonb_array_elements(coalesce(content->case when p_kind='event_click' then 'events' else 'offerings' end,'[]')) where value->>'id'=p_item_id::text;
    if item is null or (p_kind='event_click' and (item->>'ends_at')::timestamptz<=now()) then return false; end if;
  elsif p_item_id is not null then return false; end if;
  insert into public.place_activity(event_id,place_id,kind,item_id,visitor_hash) select p_event_id,id,p_kind,p_item_id,p_visitor_hash from public.places where id::text=p_place_id on conflict do nothing;
  return found;
end $$;

create function public.get_place_activity(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare first_day date := (now() at time zone 'UTC')::date-29; result jsonb; begin
  if not place_management_private.can_edit_growth(p_place_id) then raise exception 'Bloom or an active Thrive pilot is required to view activity.'; end if;
  select jsonb_build_object('from',first_day,'through',first_day+29,'timezone','UTC',
    'current',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at >= first_day::timestamp at time zone 'UTC' group by kind) c),'{}'),
    'previous',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at >= (first_day-30)::timestamp at time zone 'UTC' and created_at < first_day::timestamp at time zone 'UTC' group by kind) c),'{}'),
    'daily',(select jsonb_agg(jsonb_build_object('day',day::date) || coalesce(totals,'{}') order by day) from generate_series(first_day::timestamp,(first_day+29)::timestamp,interval '1 day') day left join lateral (select jsonb_object_agg(kind,total) totals from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and (created_at at time zone 'UTC')::date=day::date group by kind) d) counts on true),
    'items',coalesce((select jsonb_agg(to_jsonb(c)) from (select item_id,kind,count(*) total from public.place_activity where place_id::text=p_place_id and item_id is not null and created_at >= first_day::timestamp at time zone 'UTC' group by item_id,kind order by count(*) desc) c),'[]')) into result;
  return result;
end $$;
create function public.prune_place_activity() returns void language sql security definer set search_path = '' as $$ delete from public.place_activity where created_at<now()-interval '89 days' $$;

revoke all on all functions in schema place_management_private from public,anon,authenticated;
revoke all on function public.get_growth_access(text),public.admin_set_thrive_pilot(text,timestamptz),public.publish_place_growth(text,jsonb,bigint),public.update_place_essentials(text,jsonb,bigint),public.get_place_activity(text),public.record_place_activity(text,text,uuid,uuid,text),public.prune_place_activity() from public,anon,authenticated;
grant execute on function public.get_growth_access(text),public.admin_set_thrive_pilot(text,timestamptz),public.publish_place_growth(text,jsonb,bigint),public.update_place_essentials(text,jsonb,bigint),public.get_place_activity(text) to authenticated;
grant execute on function public.record_place_activity(text,text,uuid,uuid,text),public.prune_place_activity() to service_role;
commit;
