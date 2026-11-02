-- Bloom includes offerings, events, and item insights at its existing price.
-- Apply only during the separately authorized backend-first rollout.
begin;

create or replace function place_management_private.can_edit_growth(p_place_id text) returns boolean language sql stable security definer set search_path = '' as $$
  select place_management_private.confirmed_user() and (place_management_private.is_admin() or
    (place_management_private.has_membership(p_place_id) and place_management_private.subscription_active(p_place_id)))
$$;

create or replace function public.get_growth_access(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not place_management_private.confirmed_user() or not (place_management_private.has_membership(p_place_id) or place_management_private.is_admin()) then raise exception 'Approved manager access required.'; end if;
  return jsonb_build_object('can_edit', place_management_private.can_edit_growth(p_place_id),
    'can_manage_offerings', place_management_private.can_edit_growth(p_place_id),
    -- Compatibility for a previously deployed client during backend-first rollout.
    'can_thrive', place_management_private.can_edit_growth(p_place_id),
    'profile', coalesce((select to_jsonb(g) from public.public_place_growth g where place_id = p_place_id), jsonb_build_object('version',1,'content','{}'::jsonb,'operating_status','open')));
end $$;

create or replace function public.publish_place_growth(p_place_id text, p_content jsonb, p_expected_version bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.place_growth_profiles%rowtype; begin
  perform pg_advisory_xact_lock(hashtextextended(p_place_id, 0));
  if not place_management_private.can_edit_growth(p_place_id) then raise exception 'An active Bloom subscription is required to edit highlights.'; end if;
  insert into public.place_growth_profiles(place_id) select id from public.places where id::text = p_place_id on conflict do nothing;
  select * into previous from public.place_growth_profiles where place_id::text = p_place_id for update;
  if not found then raise exception 'Place not found.'; end if;
  if p_expected_version is null or p_expected_version <> previous.version then raise exception using message = 'Someone updated these highlights. Reload before publishing.', errcode = 'PT409'; end if;
  perform place_management_private.validate_growth(p_content, p_place_id);

  insert into public.place_growth_revisions(place_id, actor_id, version, content) values(p_place_id, auth.uid(), previous.version, previous.content);
  update public.place_growth_profiles set content = p_content, version = version + 1, updated_at = now() where place_id::text = p_place_id;
  insert into public.management_audit(actor_id, action, place_id) values(auth.uid(),'business_highlights_published',p_place_id);
  return (select to_jsonb(g) from public.public_place_growth g where place_id = p_place_id);
end $$;

create or replace function public.get_place_activity(p_place_id text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare first_day date := (now() at time zone 'UTC')::date-29; result jsonb; begin
  if not place_management_private.can_edit_growth(p_place_id) then raise exception 'An active Bloom subscription is required to view activity.'; end if;
  select jsonb_build_object('from',first_day,'through',first_day+29,'timezone','UTC',
    'current',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at >= first_day::timestamp at time zone 'UTC' group by kind) c),'{}'),
    'previous',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at >= (first_day-30)::timestamp at time zone 'UTC' and created_at < first_day::timestamp at time zone 'UTC' group by kind) c),'{}'),
    'daily',(select jsonb_agg(jsonb_build_object('day',day::date) || coalesce(totals,'{}') order by day) from generate_series(first_day::timestamp,(first_day+29)::timestamp,interval '1 day') day left join lateral (select jsonb_object_agg(kind,total) totals from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and (created_at at time zone 'UTC')::date=day::date group by kind) d) counts on true),
    'items',coalesce((select jsonb_agg(to_jsonb(c)) from (select item_id,kind,count(*) total from public.place_activity where place_id::text=p_place_id and item_id is not null and created_at >= first_day::timestamp at time zone 'UTC' group by item_id,kind order by count(*) desc) c),'[]')) into result;
  return result;
end $$;

create or replace function place_management_private.activity_email_eligible(p_place_id text,p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.place_memberships m join auth.users u on u.id=m.user_id
   where m.place_id::text=p_place_id and m.user_id=p_user_id and u.email_confirmed_at is not null and nullif(u.email,'') is not null)
   and place_management_private.subscription_active(p_place_id)
$$;

create or replace function public.set_activity_email_preference(p_place_id text,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null or not place_management_private.confirmed_user() or not place_management_private.has_membership(p_place_id) then raise exception 'Approved manager access required.'; end if;
 if p_enabled and not place_management_private.activity_email_eligible(p_place_id,auth.uid()) then raise exception 'An active Bloom subscription is required for reports.'; end if;
 insert into public.place_activity_email_preferences(place_id,user_id,enabled,enabled_since)
   select m.place_id,auth.uid(),p_enabled,case when p_enabled then now() else null end from public.place_memberships m where m.place_id::text=p_place_id and m.user_id=auth.uid()
   on conflict(place_id,user_id) do update set enabled=excluded.enabled,updated_at=now(),
     enabled_since=case when excluded.enabled and not public.place_activity_email_preferences.enabled then now() else public.place_activity_email_preferences.enabled_since end;
 if not p_enabled then update public.place_activity_email_jobs set suppressed_at=now(),suppression_reason='Reports turned off.',lease_token=null
   where place_id::text=p_place_id and user_id=auth.uid() and sent_at is null and suppressed_at is null; end if;
 return public.get_activity_email_preference(p_place_id);
end $$;

create or replace function public.take_activity_email_reports(p_limit integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
declare job record; result jsonb:='[]'; details jsonb; token uuid; begin
 -- Recheck current membership, consent, entitlement, and verified recipient before any lease.
 update public.place_activity_email_jobs j set suppressed_at=now(),suppression_reason='Report access or preference changed.',lease_token=null
   where j.sent_at is null and j.suppressed_at is null and not exists(select 1 from public.place_activity_email_preferences pref
     where pref.place_id=j.place_id and pref.user_id=j.user_id and pref.enabled and place_management_private.activity_email_eligible(j.place_id::text,j.user_id));
 update public.place_activity_email_jobs j set suppressed_at=now(),suppression_reason='Verified email changed after a delivery attempt.',lease_token=null
   from auth.users u where u.id=j.user_id and j.payload is not null and j.payload->>'account_email' is distinct from u.email and j.sent_at is null and j.suppressed_at is null;
 for job in select j.*,p.name as place_name,p."urlSlug" as place_slug,u.email,pref.unsubscribe_token from public.place_activity_email_jobs j
   join public.places p on p.id=j.place_id join auth.users u on u.id=j.user_id
   join public.place_activity_email_preferences pref on pref.place_id=j.place_id and pref.user_id=j.user_id
   where j.sent_at is null and j.suppressed_at is null and j.available_at<=now() and j.attempts<8
     and (j.first_attempt_at is null or j.first_attempt_at>now()-interval '23 hours')
   order by j.available_at,j.id for update of j skip locked limit greatest(1,least(coalesce(p_limit,10),10)) loop
   details:=coalesce(job.payload,place_management_private.activity_month_snapshot(job.place_id::text,job.period_start,job.period_end)
     || jsonb_build_object('account_email',job.email,'place_name',job.place_name,'place_slug',job.place_slug,'unsubscribe_token',job.unsubscribe_token,
       'plan','Bloom'));
   token:=gen_random_uuid();
   update public.place_activity_email_jobs set payload=details,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
     available_at=now()+interval '5 minutes',lease_token=token where id=job.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'lease_token',token));
 end loop;
 return result;
end $$;

drop function public.admin_set_thrive_pilot(text,timestamptz);
create or replace function place_management_private.activity_month_snapshot(p_place_id text,p_start date,p_end date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare previous_start date:= (p_start-interval '1 month')::date; data jsonb; begin
 select jsonb_build_object('period_start',p_start,'period_end',p_end,'previous_start',previous_start,'timezone','UTC',
   'advice_at',now(),'profile',coalesce((select content from public.place_growth_profiles where place_id::text=p_place_id),'{}'::jsonb),
   'current',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at>=p_start::timestamp at time zone 'UTC' and created_at<p_end::timestamp at time zone 'UTC' group by kind) c),'{}'),
   'previous',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at>=previous_start::timestamp at time zone 'UTC' and created_at<p_start::timestamp at time zone 'UTC' group by kind) c),'{}'),
   'items',case when place_management_private.subscription_active(p_place_id) then coalesce((select jsonb_agg(to_jsonb(c)) from (
     select a.item_id,a.kind,count(*) total,coalesce((select value->>'title' from public.place_growth_profiles g,
       lateral jsonb_array_elements(coalesce(g.content->'offerings','[]') || coalesce(g.content->'events','[]'))
       where g.place_id::text=p_place_id and value->>'id'=a.item_id::text limit 1),'Previously published item') title
     from public.place_activity a where a.place_id::text=p_place_id and a.item_id is not null and a.created_at>=p_start::timestamp at time zone 'UTC' and a.created_at<p_end::timestamp at time zone 'UTC'
     group by a.item_id,a.kind order by count(*) desc,a.item_id limit 5) c),'[]') else '[]'::jsonb end) into data;
 return data;
end $$;
commit;
