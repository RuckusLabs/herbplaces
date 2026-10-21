-- Enforce the Bloom gallery allowance at the write boundary; existing images are not removed.
begin;

create or replace function place_management_private.validate_place_content(p_place_id text, p_content jsonb, p_previous jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare field text; link jsonb; photo text; category text; photo_description record;
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
    then raise exception 'Use up to ten links.'; end if;
  for link in select value from jsonb_array_elements(p_content->'social_links') loop
    if jsonb_typeof(link) <> 'object' or jsonb_typeof(link->'label') is distinct from 'string' or jsonb_typeof(link->'url') is distinct from 'string'
      or coalesce(link->>'label', '') = '' or length(link->>'label') > 80
      or coalesce(link->>'url', '') !~* '^https?://[^[:space:]]+$' or length(link->>'url') > 2000
      then raise exception 'Each link needs text and a complete HTTP or HTTPS URL.'; end if;
  end loop;
  if p_content->'category_ids' <> 'null'::jsonb then
    if jsonb_typeof(p_content->'category_ids') <> 'array' or jsonb_array_length(p_content->'category_ids') > 4 then raise exception 'Invalid categories.'; end if;
    for category in select jsonb_array_elements_text(p_content->'category_ids') loop
      if category not in ('shops','herbalists','gardens','workshops') then raise exception 'Unknown category.'; end if;
    end loop;
  end if;
  if jsonb_typeof(p_content->'photos') <> 'array' then raise exception 'Invalid photo gallery.'; end if;
  if jsonb_array_length(p_content->'photos') > 10 then raise exception 'Use up to 10 photos.'; end if;
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

commit;
