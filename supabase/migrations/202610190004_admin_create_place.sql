begin;

-- Imported beta listings used explicit IDs; advance an existing serial/identity
-- sequence only when it is behind those rows. Never rewind a live sequence.
lock table public.places in share row exclusive mode;
do $$ declare sequence_name text; sequence_value bigint; called boolean; highest_id bigint; begin
  sequence_name := pg_get_serial_sequence('public.places','id');
  if sequence_name is not null then
    execute format('select last_value,is_called from %s', sequence_name::regclass) into sequence_value, called;
    select max(id)::text::bigint into highest_id from public.places;
    if highest_id > sequence_value or (highest_id = sequence_value and not called) then
      perform setval(sequence_name::regclass, highest_id, true);
    end if;
  end if;
end $$;

-- Remember a creation request so a lost response can be retried without making
-- a second listing. The place ID retains the existing table's native type.
do $$ declare id_type text; begin
  select format_type(a.atttypid, a.atttypmod) into id_type from pg_attribute a
    where a.attrelid = 'public.places'::regclass and a.attname = 'id';
  execute format('create table place_management_private.place_creations (
    request_id uuid primary key, actor_id uuid references auth.users(id) on delete set null,
    place_id %s not null references public.places(id) on delete cascade,
    created_at timestamptz not null default now())', id_type);
end $$;
revoke all on place_management_private.place_creations from public, anon, authenticated;

create function public.admin_create_place(p_content jsonb, p_slug text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare content public.places%rowtype; created public.places%rowtype; previous place_management_private.place_creations%rowtype;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_request_id is null then raise exception 'A creation request ID is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 3));
  select * into previous from place_management_private.place_creations where request_id = p_request_id;
  if found then
    if previous.actor_id is distinct from auth.uid() then raise exception 'This creation request belongs to another administrator.'; end if;
    return (select to_jsonb(p) from public.public_places p where p.id = previous.place_id);
  end if;
  if p_slug is null or length(p_slug) > 200 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Use a lowercase URL slug with hyphens (up to 200 characters).'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_slug, 4));
  if exists(select 1 from public.places where "urlSlug" = p_slug) then raise exception 'This URL is already in use. Choose another public URL.'; end if;
  perform place_management_private.validate_place_content('', p_content, '{"photos":[]}'::jsonb);
  if p_content->'photos' <> '[]'::jsonb or coalesce(p_content->>'coverPhoto','') <> '' then
    raise exception 'Create the place before uploading photos.';
  end if;
  content := jsonb_populate_record(null::public.places, p_content);
  insert into public.places (name, "urlSlug", tagline, description, website, address, city, state, zip,
    phone, hours, social_links, category_ids, photos, "coverPhoto", photo_alt, "isFeatured", "isVerified", geocode_status)
  values (btrim(content.name), p_slug, content.tagline, content.description, content.website, content.address,
    content.city, content.state, content.zip, content.phone, content.hours, content.social_links, content.category_ids,
    content.photos, content."coverPhoto", content.photo_alt, false, false,
    case when concat(content.address,content.city,content.state,content.zip) <> '' then 'pending' else 'review' end)
  returning * into created;
  insert into public.place_subscriptions(place_id) values(created.id);
  insert into place_management_private.place_creations(request_id, actor_id, place_id) values(p_request_id,auth.uid(),created.id);
  insert into public.management_audit(actor_id, action, place_id) values(auth.uid(),'place_created',created.id::text);
  return (select to_jsonb(p) from public.public_places p where p.id = created.id);
end $$;
revoke all on function public.admin_create_place(jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_create_place(jsonb,text,uuid) to authenticated;

commit;
