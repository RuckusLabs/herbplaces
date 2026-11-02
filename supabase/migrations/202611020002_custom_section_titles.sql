-- Optional public section headings. Apply after the Bloom advanced tools migration.
begin;

create or replace function place_management_private.validate_growth(p_content jsonb, p_place_id text) returns void language plpgsql security definer set search_path = '' as $$
declare field text; item jsonb; a jsonb; image text; item_id text; seen_ids text[] := '{}'; event_mode boolean; starts timestamptz; ends timestamptz;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 100000
    or not (p_content ?& array['primary_action','specialties','languages','access_notes','announcement','offerings','events']) then raise exception 'Incomplete business highlights.'; end if;
  for field in select jsonb_object_keys(p_content) loop
    if field not in ('primary_action','specialties','languages','access_notes','announcement','offerings','events','section_titles') then raise exception 'Unknown business highlights field.'; end if;
  end loop;
  if p_content ? 'section_titles' then
    if jsonb_typeof(p_content->'section_titles') is distinct from 'object' then raise exception 'Invalid section titles.'; end if;
    for field in select jsonb_object_keys(p_content->'section_titles') loop
      if field not in ('specialties','offerings','events') or jsonb_typeof(p_content->'section_titles'->field) is distinct from 'string' or length(p_content->'section_titles'->>field) > 80 then raise exception 'Use section titles of up to 80 characters.'; end if;
    end loop;
  end if;
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

create or replace function public.publish_place_growth(p_place_id text, p_content jsonb, p_expected_version bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.place_growth_profiles%rowtype; begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.can_edit_growth(p_place_id) then raise exception 'An active Bloom subscription is required to edit highlights.'; end if;
  insert into public.place_growth_profiles(place_id) select id from public.places where id::text = p_place_id on conflict do nothing;
  select * into previous from public.place_growth_profiles where place_id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or p_expected_version <> previous.version then raise exception using message = 'Someone updated these highlights. Reload before publishing.', errcode = 'PT409'; end if;
  -- Older clients omit heading settings. Keep the saved titles when they edit.
  if not (p_content ? 'section_titles') then p_content := p_content || jsonb_build_object('section_titles',coalesce(previous.content->'section_titles','{}'::jsonb)); end if;
  perform place_management_private.validate_growth(p_content, p_place_id);

  insert into public.place_growth_revisions(place_id, actor_id, version, content) values(p_place_id, auth.uid(), previous.version, previous.content);
  update public.place_growth_profiles set content = p_content, version = version + 1, updated_at = now() where place_id::text = p_place_id;
  insert into public.management_audit(actor_id, action, place_id) values(auth.uid(),'business_highlights_published',p_place_id);
  return (select to_jsonb(g) from public.public_place_growth g where place_id = p_place_id);
end $$;
commit;
