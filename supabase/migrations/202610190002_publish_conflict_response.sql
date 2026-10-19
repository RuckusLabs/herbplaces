-- A stale content version is an HTTP conflict, not a retryable database error.
-- PostgREST can retry SQLSTATE 40001 indefinitely; PT409 returns immediately.
-- See https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
begin;

create or replace function public.publish_place(p_place_id text, p_content jsonb, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.places%rowtype; next_place public.places%rowtype; address_changed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.can_edit(p_place_id) then raise exception 'An approved manager and an active Bloom subscription are required.'; end if;
  select * into previous from public.places where id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or previous.content_version <> p_expected_version then
    raise exception using message = 'Someone else updated this place. Reload the latest version before publishing.', errcode = 'PT409'; end if;
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

revoke all on function public.publish_place(text,jsonb,bigint) from public, anon;
grant execute on function public.publish_place(text,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
