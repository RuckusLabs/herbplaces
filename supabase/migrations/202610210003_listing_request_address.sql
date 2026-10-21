begin;

alter table public.place_listing_requests
  add column address text not null default '' check (char_length(address) <= 500),
  add column zip text not null default '' check (char_length(zip) <= 100);

-- Multiple branches of the same business can request listings in one city.
drop index public.one_pending_listing_request;
create unique index one_pending_listing_request on public.place_listing_requests
  (user_id, lower(name), lower(city), lower(address)) where status = 'pending';

-- Replace rather than overload, so PostgREST can resolve old and new clients.
-- Defaults retain compatibility with existing six-argument callers.
drop function public.request_place_listing(text,text,text,text,text,uuid);

create function public.request_place_listing(p_name text, p_website text, p_city text, p_region text, p_notes text, p_request_id uuid, p_address text default '', p_zip text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.place_listing_requests%rowtype; result uuid;
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before requesting a listing.'; end if;
  if p_request_id is null or p_name is null or p_city is null or char_length(btrim(p_name)) not between 2 and 200
    or char_length(btrim(p_city)) not between 1 and 200 or char_length(coalesce(p_region,'')) > 200
    or char_length(coalesce(p_address,'')) > 500 or char_length(coalesce(p_zip,'')) > 100
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
    and lower(name) = lower(btrim(p_name)) and lower(city) = lower(btrim(p_city))
    and lower(address) = lower(btrim(coalesce(p_address,'')));
  if result is not null then return result; end if;
  if (select count(*) from public.place_listing_requests where user_id = auth.uid() and created_at > now()-interval '1 day') >= 5
    then raise exception 'Please wait before submitting more listing requests.'; end if;
  insert into public.place_listing_requests(id,user_id,name,website,city,region,notes,address,zip)
    values(p_request_id,auth.uid(),btrim(p_name),coalesce(p_website,''),btrim(p_city),btrim(coalesce(p_region,'')),btrim(coalesce(p_notes,'')),btrim(coalesce(p_address,'')),btrim(coalesce(p_zip,''))) returning id into result;
  return result;
end $$;

create or replace function public.get_listing_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before viewing listing requests.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'city',r.city,'region',r.region,'address',r.address,'zip',r.zip,'status',r.status,
    'place_slug',r.place_slug,'review_note',r.review_note,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb)
    from public.place_listing_requests r where r.user_id = auth.uid());
end $$;

create or replace function public.admin_listing_requests(p_query text default '', p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; total bigint;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  select count(*) into total from public.place_listing_requests r where r.status = 'pending'
    and (r.name ilike '%' || left(coalesce(p_query,''),200) || '%' or r.city ilike '%' || left(coalesce(p_query,''),200) || '%');
  select coalesce(jsonb_agg(to_jsonb(items)), '[]'::jsonb) into result from (
    select r.id,r.name,r.website,r.city,r.region,r.address,r.zip,r.notes,r.created_at,u.email
    from public.place_listing_requests r join auth.users u on u.id = r.user_id where r.status = 'pending'
      and (r.name ilike '%' || left(coalesce(p_query,''),200) || '%' or r.city ilike '%' || left(coalesce(p_query,''),200) || '%')
    order by r.created_at,r.id limit 25 offset greatest(0,least(coalesce(p_page,0),10000))*25
  ) items;
  return jsonb_build_object('items',result,'total',total);
end $$;

revoke all on function public.request_place_listing(text,text,text,text,text,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.request_place_listing(text,text,text,text,text,uuid,text,text) to authenticated;
notify pgrst, 'reload schema';

commit;
