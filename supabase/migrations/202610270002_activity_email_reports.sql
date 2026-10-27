-- Optional monthly reports. Nothing is sent until an approved manager opts in
-- and the separately authenticated delivery function is deployed and scheduled.
begin;
do $$ declare id_type text; begin
  select format_type(atttypid,atttypmod) into id_type from pg_attribute where attrelid='public.places'::regclass and attname='id';
  execute format('create table public.place_activity_email_preferences (
    place_id %s not null, user_id uuid not null, enabled boolean not null default false,
    enabled_since timestamptz, unsubscribe_token uuid not null unique default gen_random_uuid(), updated_at timestamptz not null default now(),
    primary key(place_id,user_id), foreign key(place_id,user_id) references public.place_memberships(place_id,user_id) on delete cascade)',id_type);
  execute format('create table public.place_activity_email_jobs (
    id uuid primary key default gen_random_uuid(), place_id %s not null, user_id uuid not null,
    period_start date not null, period_end date not null, payload jsonb,
    attempts integer not null default 0, first_attempt_at timestamptz, available_at timestamptz not null default now(),
    lease_token uuid, sent_at timestamptz, email_id text, suppressed_at timestamptz, suppression_reason text,
    created_at timestamptz not null default now(), unique(place_id,user_id,period_start),
    foreign key(place_id,user_id) references public.place_activity_email_preferences(place_id,user_id) on delete cascade,
    check(period_end>period_start))',id_type);
end $$;
create index pending_activity_email_jobs on public.place_activity_email_jobs(available_at) where sent_at is null and suppressed_at is null;
alter table public.place_activity_email_preferences enable row level security;
alter table public.place_activity_email_jobs enable row level security;
revoke all on public.place_activity_email_preferences,public.place_activity_email_jobs from public,anon,authenticated;
grant all on public.place_activity_email_preferences,public.place_activity_email_jobs to service_role;

create function place_management_private.activity_email_eligible(p_place_id text,p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.place_memberships m join auth.users u on u.id=m.user_id
   where m.place_id::text=p_place_id and m.user_id=p_user_id and u.email_confirmed_at is not null and nullif(u.email,'') is not null)
   and (place_management_private.subscription_active(p_place_id) or place_management_private.thrive_pilot_active(p_place_id))
$$;
create function public.get_activity_email_preference(p_place_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pref public.place_activity_email_preferences%rowtype; last_job public.place_activity_email_jobs%rowtype; begin
 if not place_management_private.confirmed_user() or not place_management_private.has_membership(p_place_id) then raise exception 'Approved manager access required.'; end if;
 select * into pref from public.place_activity_email_preferences where place_id::text=p_place_id and user_id=auth.uid();
 select * into last_job from public.place_activity_email_jobs where place_id::text=p_place_id and user_id=auth.uid() order by period_start desc limit 1;
 return jsonb_build_object('enabled',coalesce(pref.enabled,false),'eligible',place_management_private.activity_email_eligible(p_place_id,auth.uid()),
   'last_report',case when last_job.id is null then null else jsonb_build_object('period_start',last_job.period_start,'period_end',last_job.period_end,
     'sent_at',last_job.sent_at,'status',case when last_job.sent_at is not null then 'sent' when last_job.suppressed_at is not null then 'stopped'
       when last_job.attempts>=8 or last_job.first_attempt_at<=now()-interval '23 hours' then 'needs_attention' else 'queued' end) end);
end $$;
create function public.set_activity_email_preference(p_place_id text,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null or not place_management_private.confirmed_user() or not place_management_private.has_membership(p_place_id) then raise exception 'Approved manager access required.'; end if;
 if p_enabled and not place_management_private.activity_email_eligible(p_place_id,auth.uid()) then raise exception 'An active Bloom subscription or Thrive pilot is required for reports.'; end if;
 insert into public.place_activity_email_preferences(place_id,user_id,enabled,enabled_since)
   select m.place_id,auth.uid(),p_enabled,case when p_enabled then now() else null end from public.place_memberships m where m.place_id::text=p_place_id and m.user_id=auth.uid()
   on conflict(place_id,user_id) do update set enabled=excluded.enabled,updated_at=now(),
     enabled_since=case when excluded.enabled and not public.place_activity_email_preferences.enabled then now() else public.place_activity_email_preferences.enabled_since end;
 if not p_enabled then update public.place_activity_email_jobs set suppressed_at=now(),suppression_reason='Reports turned off.',lease_token=null
   where place_id::text=p_place_id and user_id=auth.uid() and sent_at is null and suppressed_at is null; end if;
 return public.get_activity_email_preference(p_place_id);
end $$;

create function place_management_private.activity_month_snapshot(p_place_id text,p_start date,p_end date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare previous_start date:= (p_start-interval '1 month')::date; data jsonb; begin
 select jsonb_build_object('period_start',p_start,'period_end',p_end,'previous_start',previous_start,'timezone','UTC',
   'current',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at>=p_start::timestamp at time zone 'UTC' and created_at<p_end::timestamp at time zone 'UTC' group by kind) c),'{}'),
   'previous',coalesce((select jsonb_object_agg(kind,total) from (select kind,count(*) total from public.place_activity where place_id::text=p_place_id and created_at>=previous_start::timestamp at time zone 'UTC' and created_at<p_start::timestamp at time zone 'UTC' group by kind) c),'{}'),
   'items',case when place_management_private.thrive_pilot_active(p_place_id) then coalesce((select jsonb_agg(to_jsonb(c)) from (
     select a.item_id,a.kind,count(*) total,coalesce((select value->>'title' from public.place_growth_profiles g,
       lateral jsonb_array_elements(coalesce(g.content->'offerings','[]') || coalesce(g.content->'events','[]'))
       where g.place_id::text=p_place_id and value->>'id'=a.item_id::text limit 1),'Previously published item') title
     from public.place_activity a where a.place_id::text=p_place_id and a.item_id is not null and a.created_at>=p_start::timestamp at time zone 'UTC' and a.created_at<p_end::timestamp at time zone 'UTC'
     group by a.item_id,a.kind order by count(*) desc,a.item_id limit 5) c),'[]') else '[]'::jsonb end) into data;
 return data;
end $$;
create function public.enqueue_activity_email_reports(p_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare ending date:=date_trunc('month',now() at time zone 'UTC')::date; starting date:=(ending-interval '1 month')::date; added integer; begin
 delete from public.place_activity_email_jobs where created_at<now()-interval '13 months';
 insert into public.place_activity_email_jobs(place_id,user_id,period_start,period_end)
   select pref.place_id,pref.user_id,starting,ending from public.place_activity_email_preferences pref
   where pref.enabled and pref.enabled_since<ending::timestamp at time zone 'UTC'
     and place_management_private.activity_email_eligible(pref.place_id::text,pref.user_id)
     and not exists(select 1 from public.place_activity_email_jobs j where j.place_id=pref.place_id and j.user_id=pref.user_id and j.period_start=starting)
   order by pref.place_id,pref.user_id limit greatest(1,least(coalesce(p_limit,100),1000)) on conflict do nothing;
 get diagnostics added=row_count; return added;
end $$;

create function public.take_activity_email_reports(p_limit integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
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
       'plan',case when place_management_private.thrive_pilot_active(job.place_id::text) then 'Thrive pilot' else 'Bloom' end));
   token:=gen_random_uuid();
   update public.place_activity_email_jobs set payload=details,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
     available_at=now()+interval '5 minutes',lease_token=token where id=job.id;
   result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'lease_token',token));
 end loop;
 return result;
end $$;

-- Called just before delivery, so stopping reports, manager removal, a lapse, or
-- a verified-email change does not leave previously leased snapshots sendable.
create function public.prepare_activity_email_report(p_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.place_activity_email_jobs%rowtype; begin
 select * into job from public.place_activity_email_jobs where id=p_id and lease_token=p_lease_token and sent_at is null and suppressed_at is null for update;
 if not found then return null; end if;
 if not exists(select 1 from public.place_activity_email_preferences pref join auth.users u on u.id=pref.user_id
     where pref.place_id=job.place_id and pref.user_id=job.user_id and pref.enabled
       and place_management_private.activity_email_eligible(job.place_id::text,job.user_id) and u.email=job.payload->>'account_email') then
   update public.place_activity_email_jobs set suppressed_at=now(),suppression_reason='Recipient or access changed before delivery.',lease_token=null where id=p_id;
   return null;
 end if;
 return jsonb_build_object('id',job.id,'lease_token',job.lease_token,'payload',job.payload);
end $$;
create function public.finish_activity_email_report(p_id uuid,p_lease_token uuid,p_email_id text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.place_activity_email_jobs set sent_at=case when nullif(p_email_id,'') is not null then now() else null end,email_id=nullif(p_email_id,''),lease_token=null
   where id=p_id and lease_token=p_lease_token and sent_at is null and suppressed_at is null;
 if not found then raise exception 'Report lease is no longer valid.'; end if;
end $$;
create function public.unsubscribe_activity_emails(p_token uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.place_activity_email_preferences set enabled=false,updated_at=now() where unsubscribe_token=p_token;
 update public.place_activity_email_jobs j set suppressed_at=now(),suppression_reason='Unsubscribed from an email.',lease_token=null
   from public.place_activity_email_preferences pref where pref.place_id=j.place_id and pref.user_id=j.user_id and pref.unsubscribe_token=p_token and j.sent_at is null and j.suppressed_at is null;
end $$;
create function public.prune_activity_email_history() returns void language sql security definer set search_path='' as $$ delete from public.place_activity_email_jobs where created_at<now()-interval '13 months' $$;
revoke all on function public.prune_activity_email_history() from public,anon,authenticated;
grant execute on function public.prune_activity_email_history() to service_role;
revoke all on function place_management_private.activity_email_eligible(text,uuid),place_management_private.activity_month_snapshot(text,date,date) from public,anon,authenticated;
revoke all on function public.get_activity_email_preference(text),public.set_activity_email_preference(text,boolean),public.enqueue_activity_email_reports(integer),public.take_activity_email_reports(integer),public.prepare_activity_email_report(uuid,uuid),public.finish_activity_email_report(uuid,uuid,text),public.unsubscribe_activity_emails(uuid) from public,anon,authenticated;
grant execute on function public.get_activity_email_preference(text),public.set_activity_email_preference(text,boolean) to authenticated;
grant execute on function public.enqueue_activity_email_reports(integer),public.take_activity_email_reports(integer),public.prepare_activity_email_report(uuid,uuid),public.finish_activity_email_report(uuid,uuid,text),public.unsubscribe_activity_emails(uuid) to service_role;
commit;
