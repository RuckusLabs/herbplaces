begin;
-- Preserve a real place relationship when the public URL changes later.
do $$ declare id_type text; begin
  select format_type(atttypid,atttypmod) into id_type from pg_attribute where attrelid='public.places'::regclass and attname='id';
  execute format('alter table public.place_listing_requests add column place_ref_id %s references public.places(id) on delete cascade', id_type);
end $$;
update public.place_listing_requests r set place_ref_id=p.id from public.places p where r.place_slug=p."urlSlug";
create function place_management_private.link_requested_place() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select id into new.place_ref_id from public.places where "urlSlug"=new.place_slug;
  return new;
end $$;
revoke all on function place_management_private.link_requested_place() from public,anon,authenticated,service_role;
create trigger link_requested_place before insert or update of place_slug on public.place_listing_requests for each row execute function place_management_private.link_requested_place();

-- Block a concurrent save from recreating a dangling favorite after deletion.
create function place_management_private.require_favorite_place() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.item_type='place' then
    perform 1 from public.places where id::text=new.item_id for key share;
    if not found then raise exception 'This place is no longer available.'; end if;
  end if;
  return new;
end $$;
revoke all on function place_management_private.require_favorite_place() from public,anon,authenticated,service_role;
do $$ begin
  if to_regclass('public.favorites') is not null then execute 'create trigger require_favorite_place before insert or update of item_id,item_type on public.favorites for each row execute function place_management_private.require_favorite_place()'; end if;
end $$;

create table place_management_private.place_deletions (
  place_id text primary key, slug text not null, token uuid not null default gen_random_uuid(),
  assets jsonb not null, created_at timestamptz not null default now()
);
revoke all on place_management_private.place_deletions from public, anon, authenticated, service_role;

create function place_management_private.place_image_references() returns table(place_id text, url text)
language sql stable security definer set search_path = '' as $$
  select p.id::text, p."coverPhoto" from public.places p where coalesce(p."coverPhoto",'')<>''
  union select p.id::text, a.value from public.places p cross join lateral jsonb_array_elements_text(coalesce(to_jsonb(p.photos),'[]'::jsonb)) a
  union select r.place_id::text, r.content->>'coverPhoto' from public.place_revisions r where coalesce(r.content->>'coverPhoto','')<>''
  union select r.place_id::text, a.value from public.place_revisions r cross join lateral jsonb_array_elements_text(coalesce(r.content->'photos','[]'::jsonb)) a
  union select u.place_id::text, u.url from public.place_uploads u
$$;
revoke all on function place_management_private.place_image_references() from public, anon, authenticated, service_role;

create function public.plan_place_deletion(p_actor_id uuid, p_place_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype; job place_management_private.place_deletions%rowtype;
begin
  if not exists(select 1 from public.site_admins a join auth.users u on u.id=a.user_id where a.user_id=p_actor_id and u.email_confirmed_at is not null) then raise exception 'Administrator access required.'; end if;
  select * into job from place_management_private.place_deletions where place_id=p_place_id;
  if found then return jsonb_build_object('cleanup_pending',true,'slug',job.slug,'job',to_jsonb(job)); end if;
  select * into target from public.places where id::text=p_place_id;
  if not found then return jsonb_build_object('already_removed',true); end if;
  return jsonb_build_object('place',jsonb_build_object('id',target.id::text,'name',target.name,'slug',target."urlSlug",'version',target.content_version),
    'subscription',(select to_jsonb(s) from public.place_subscriptions s where s.place_id=target.id),
    'urls',coalesce((select jsonb_agg(url) from place_management_private.place_image_references() where place_id=p_place_id),'[]'::jsonb),
    'other_urls',coalesce((select jsonb_agg(url) from place_management_private.place_image_references() where place_id<>p_place_id),'[]'::jsonb),
    'folder_assets',coalesce((select jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name)) from storage.objects o where o.bucket_id='place-photos' and o.name like p_place_id || '/%'),'[]'::jsonb),
    'managers',(select count(*) from public.place_memberships where place_id=target.id),
    'revisions',(select count(*) from public.place_revisions where place_id=target.id));
end $$;

create function public.delete_place_records(p_actor_id uuid, p_place_id text, p_slug text, p_version bigint, p_subscription jsonb, p_assets jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.places%rowtype; subscription jsonb; job place_management_private.place_deletions%rowtype; claim_ids uuid[]; request_ids uuid[];
begin
  if not exists(select 1 from public.site_admins a join auth.users u on u.id=a.user_id where a.user_id=p_actor_id and u.email_confirmed_at is not null) then raise exception 'Administrator access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_place_id,2));
  select * into job from place_management_private.place_deletions where place_id=p_place_id for update;
  if found then
    if job.slug is distinct from p_slug then raise exception 'The confirmation does not match the place.'; end if;
    return to_jsonb(job);
  end if;
  select * into target from public.places where id::text=p_place_id for update;
  if not found then raise exception 'Place not found. Refresh the directory.'; end if;
  if target."urlSlug" is distinct from p_slug then raise exception 'The confirmation does not match the place.'; end if;
  if target.content_version is distinct from p_version then raise exception 'Place changed. Refresh and review deletion again.'; end if;
  select to_jsonb(s) into subscription from public.place_subscriptions s where s.place_id=target.id for update;
  if subscription is distinct from p_subscription then raise exception 'Billing changed. Refresh and review deletion again.'; end if;
  if coalesce(subscription->>'status','none') not in ('none','canceled','incomplete_expired') then raise exception 'Resolve the subscription in Stripe before deleting this place.'; end if;
  if nullif(subscription->>'checkout_session_id','') is null and (subscription->>'checkout_expires_at')::timestamptz>now() then raise exception 'Checkout is being prepared. Wait for it to expire before deleting.'; end if;
  if jsonb_typeof(p_assets) <> 'array' or p_assets is null then raise exception 'Invalid image cleanup plan.'; end if;
  select array_agg(id) into claim_ids from public.place_claims where place_id=target.id;
  select array_agg(id) into request_ids from public.place_listing_requests where place_ref_id=target.id or (place_ref_id is null and place_slug=target."urlSlug");
  -- Include uploads registered since the preview while the parent row is locked.
  select coalesce(jsonb_agg(distinct asset),'[]'::jsonb) into p_assets from (
    select value as asset from jsonb_array_elements(p_assets)
    union select jsonb_build_object('bucket',o.bucket_id,'path',o.name) from storage.objects o
      where o.bucket_id='place-photos' and o.name like p_place_id || '/%'
        and not exists(select 1 from place_management_private.place_image_references() r where r.place_id<>p_place_id
          and r.url like '%/storage/v1/object/public/place-photos/' || o.name)
  ) candidates;
  insert into place_management_private.place_deletions(place_id,slug,assets) values(p_place_id,p_slug,p_assets) returning * into job;
  delete from public.place_admin_notifications where (kind='locations' and reference=p_place_id)
    or (kind='claims' and reference=any(claim_ids::text[])) or (kind='listing-requests' and reference=any(request_ids::text[]));
  delete from public.place_listing_requests where id=any(request_ids);
  delete from public.management_audit where place_id=p_place_id or details->>'request_id'=any(request_ids::text[]);
  if to_regclass('public.favorites') is not null then execute 'delete from public.favorites where item_type=''place'' and item_id=$1' using p_place_id; end if;
  delete from public.places where id=target.id;
  return to_jsonb(job);
end $$;

create function public.finish_place_deletion(p_place_id text, p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from place_management_private.place_deletions where place_id=p_place_id and token=p_token;
end $$;
create function public.admin_place_cleanup_jobs() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',place_id,'slug',slug,'created_at',created_at)),'[]'::jsonb) from place_management_private.place_deletions);
end $$;
revoke all on function public.plan_place_deletion(uuid,text) from public,anon,authenticated;
revoke all on function public.delete_place_records(uuid,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.finish_place_deletion(text,uuid) from public,anon,authenticated;
grant execute on function public.plan_place_deletion(uuid,text),public.delete_place_records(uuid,text,text,bigint,jsonb,jsonb),public.finish_place_deletion(text,uuid) to service_role;
revoke all on function public.admin_place_cleanup_jobs() from public,anon,authenticated,service_role;
grant execute on function public.admin_place_cleanup_jobs() to authenticated;
commit;
