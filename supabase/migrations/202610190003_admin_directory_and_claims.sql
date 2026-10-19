begin;

-- A public ownership flag reveals no manager identities. Pending invitations also
-- reserve a listing; an expired subscription never makes it unclaimed again.
create or replace view public.public_places as
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
  p.content_version, p.geocode_status, p.updated_at,
  (exists(select 1 from public.place_memberships m where m.place_id = p.id)
    or exists(select 1 from public.place_invitations i where i.place_id = p.id)) as is_claimed
from public.places p;

create or replace function public.request_place_claim(p_place_id text, p_relationship text, p_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before requesting a place.'; end if;
  if char_length(btrim(p_relationship)) not between 2 and 200 or char_length(btrim(p_evidence)) not between 10 and 3000
    or p_relationship is null or p_evidence is null then raise exception 'Add your relationship and supporting information.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if exists(select 1 from public.public_places where id::text = p_place_id and is_claimed) then
    raise exception 'This place already has a manager. Contact Little Herb Places for access.';
  end if;
  if place_management_private.has_membership(p_place_id) then raise exception 'You already manage this place.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  if (select count(*) from public.place_claims where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10
    then raise exception 'Please wait before submitting more requests.'; end if;
  insert into public.place_claims(place_id, user_id, relationship, evidence)
    select id, auth.uid(), btrim(p_relationship), btrim(p_evidence) from public.places where id::text = p_place_id;
  if not found then raise exception 'Place not found.'; end if;
end $$;

-- A reservation closes the interval between authorization in Postgres and the
-- Auth admin API deletion. Assignment and account mutations lock the same row.
create table place_management_private.user_removals (
  user_id uuid primary key, email text not null unique, actor_id uuid not null,
  token uuid not null default gen_random_uuid(), created_at timestamptz not null default now()
);
revoke all on place_management_private.user_removals from public, anon, authenticated;

create or replace function place_management_private.confirmed_user() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
    and not exists(select 1 from place_management_private.user_removals where user_id = auth.uid())
$$;

create function place_management_private.guard_user_removal() returns trigger language plpgsql security definer
set search_path = '' as $$
declare target_id uuid; target_email text;
begin
  if tg_table_name = 'users' then target_id := new.id; target_email := lower(new.email);
  elsif tg_table_name = 'place_invitations' then target_email := new.email;
  else target_id := new.user_id; end if;
  perform 1 from public.management_users where user_id = target_id or email = target_email for update;
  if exists(select 1 from place_management_private.user_removals where user_id = target_id or email = target_email) then
    raise exception 'This account is being removed. Try again after removal finishes.';
  end if;
  return new;
end $$;
create trigger guard_removing_member before insert or update on public.place_memberships
  for each row execute function place_management_private.guard_user_removal();
create trigger guard_removing_invitation before insert or update on public.place_invitations
  for each row execute function place_management_private.guard_user_removal();
create trigger guard_removing_admin before insert or update on public.site_admins
  for each row execute function place_management_private.guard_user_removal();
create trigger guard_removing_account before insert or update of email, email_confirmed_at on auth.users
  for each row execute function place_management_private.guard_user_removal();

create or replace function public.activate_place_invitations() returns void language plpgsql security definer
set search_path = '' as $$
declare invitation public.place_invitations%rowtype; current_email text;
begin
  if not place_management_private.confirmed_user() then raise exception 'Confirm your email before managing a place.'; end if;
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
create or replace function public.management_service_access(p_place_id text, p_user_id uuid, p_billing boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if exists(select 1 from place_management_private.user_removals where user_id = p_user_id) then return null; end if;
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

create function public.prepare_user_removal(p_actor_id uuid, p_user_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.management_users%rowtype; reservation place_management_private.user_removals%rowtype;
begin
  if not exists(select 1 from public.site_admins a join auth.users u on u.id = a.user_id
    where a.user_id = p_actor_id and u.email_confirmed_at is not null)
    then raise exception 'Administrator access required.'; end if;
  if p_actor_id = p_user_id then raise exception 'You cannot remove your own account.'; end if;
  select * into target from public.management_users where user_id = p_user_id for update;
  -- Retry cleanup after an interrupted Auth deletion; the reservation survives it.
  if target.user_id is null then
    select * into reservation from place_management_private.user_removals where user_id = p_user_id for update;
    if reservation.user_id is null then raise exception 'User not found. Refresh the directory.'; end if;
    if p_email is null or reservation.email <> lower(btrim(p_email)) then raise exception 'The confirmation email does not match.'; end if;
    return to_jsonb(reservation);
  end if;
  if target.email <> lower(btrim(p_email)) or p_email is null then raise exception 'The confirmation email does not match.'; end if;
  if exists(select 1 from public.site_admins where user_id = p_user_id) then
    raise exception 'Administrator accounts cannot be removed here.';
  end if;
  if exists(select 1 from public.place_memberships m join public.place_subscriptions s on s.place_id = m.place_id
    where m.user_id = p_user_id and m.is_billing_contact and (s.status not in ('none','canceled','incomplete_expired') or s.stripe_customer_id is not null or s.checkout_expires_at > now())) then
    raise exception 'Reassign this user’s billing contact before removing the account.';
  end if;
  insert into place_management_private.user_removals(user_id, email, actor_id)
    values(p_user_id, target.email, p_actor_id)
    on conflict(user_id) do update set token = gen_random_uuid(), actor_id = excluded.actor_id, created_at = now()
      where user_removals.created_at < now() - interval '5 minutes'
    returning * into reservation;
  if reservation.user_id is null then raise exception 'Removal is already in progress. Try again shortly.'; end if;
  return to_jsonb(reservation);
end $$;

create function public.finish_user_removal(p_user_id uuid, p_token uuid, p_cancel boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare reservation place_management_private.user_removals%rowtype;
begin
  select * into reservation from place_management_private.user_removals where user_id = p_user_id and token = p_token for update;
  if not found then raise exception 'Removal reservation not found.'; end if;
  if not p_cancel then
    if exists(select 1 from auth.users where id = p_user_id) then raise exception 'Account removal has not completed.'; end if;
    delete from public.place_invitations where email = reservation.email;
    insert into public.management_audit(actor_id, action, details)
      values(reservation.actor_id, 'user_removed', jsonb_build_object('user_id', p_user_id));
  end if;
  delete from place_management_private.user_removals where user_id = p_user_id and token = p_token;
end $$;

revoke all on function place_management_private.guard_user_removal() from public, anon, authenticated;
revoke all on function public.prepare_user_removal(uuid,uuid,text), public.finish_user_removal(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.prepare_user_removal(uuid,uuid,text), public.finish_user_removal(uuid,uuid,boolean) to service_role;

-- Sort the complete filtered directory before pagination; only whitelisted keys
-- can reach the identifier in ORDER BY. JSON aggregation preserves that order.
drop function public.admin_directory(text,text,integer);
create function public.admin_directory(p_section text, p_query text default '', p_page integer default 0,
  p_sort text default '', p_desc boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; base_sql text; sort_key text; direction text := case when p_desc then 'desc' else 'asc' end;
  offset_rows bigint := greatest(0, p_page)::bigint * 25;
begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_section = 'users' then
    sort_key := case when p_sort in ('email','confirmed_at','created_at','place_count') then p_sort else 'email' end;
    base_sql := $query$
      select u.user_id, u.user_id::text as sort_id, u.email, u.confirmed_at, u.created_at,
        exists(select 1 from public.site_admins a where a.user_id = u.user_id) as is_admin,
        exists(select 1 from place_management_private.user_removals r where r.user_id = u.user_id) as removal_pending,
        exists(select 1 from public.place_memberships m join public.place_subscriptions s on s.place_id = m.place_id
          where m.user_id = u.user_id and m.is_billing_contact and (s.status not in ('none','canceled','incomplete_expired') or s.stripe_customer_id is not null or s.checkout_expires_at > now())) as billing_protected,
        (select count(*) from (
          select place_id from public.place_memberships where user_id = u.user_id
          union select place_id from public.place_invitations where email = u.email) counts) as place_count,
        coalesce((select jsonb_agg(to_jsonb(t) order by t.name, t.id) from (
          select p.id::text as id, p.name, p."urlSlug", m.is_billing_contact, false as pending
            from public.place_memberships m join public.places p on p.id = m.place_id where m.user_id = u.user_id
          union all select p.id::text, p.name, p."urlSlug", i.is_billing_contact, true
            from public.place_invitations i join public.places p on p.id = i.place_id where i.email = u.email
            and not exists(select 1 from public.place_memberships m where m.place_id = i.place_id and m.user_id = u.user_id)
        ) t), '[]') as places
      from public.management_users u where u.email ilike '%' || $1 || '%'
    $query$;
  elsif p_section = 'claims' then
    sort_key := 'created_at';
    base_sql := $query$
      select c.*, c.id::text as sort_id, u.email, p.name, p."urlSlug" from public.place_claims c
      join public.management_users u on u.user_id = c.user_id join public.places p on p.id = c.place_id
      where c.status = 'pending' and (u.email ilike '%' || $1 || '%' or p.name ilike '%' || $1 || '%')
    $query$;
  elsif p_section in ('places','locations') then
    sort_key := case when p_sort in ('name','city','subscription_status','geocode_status') then p_sort else 'name' end;
    base_sql := $query$
      select p.id::text as id, p.id::text as sort_id, p.name, p."urlSlug", p.city, p.geocode_status,
        s.status as subscription_status, s.grace_ends_at, s.paid_until
      from public.places p left join public.place_subscriptions s on s.place_id = p.id
      where p.name ilike '%' || $1 || '%' and ($2 <> 'locations' or p.geocode_status <> 'confirmed')
    $query$;
  else raise exception 'Unknown admin section.'; end if;
  execute format('with directory as (%s), page as (select * from directory order by %I %s nulls last, sort_id limit 25 offset $3)
    select jsonb_build_object(''total'', (select count(*) from directory), ''items'', coalesce((select jsonb_agg(to_jsonb(page) - ''sort_id'') from page), ''[]''))', base_sql, sort_key, direction)
    into result using left(coalesce(p_query,''),200), p_section, offset_rows;
  return result;
end $$;
revoke all on function public.admin_directory(text,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_directory(text,text,integer,text,boolean) to authenticated;

-- Preserve the existing stored link format and revision history, with generic labels.
create or replace function place_management_private.validate_place_content(p_place_id text, p_content jsonb, p_previous jsonb)
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

commit;
