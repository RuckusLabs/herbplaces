-- Local-only preparation: run only as part of a separately authorized rollout.
begin;
create table public.business_interest (
  event_id uuid primary key, session_id uuid not null,
  kind text not null check (kind in ('plan_view','plan_cta','business_selected','listing_request_started')),
  plan text not null check (plan in ('comparison','bloom')),
  entry text not null check (entry in ('existing','missing')),
  device text not null check (device in ('desktop','mobile')),
  visitor_hash text not null, created_at timestamptz not null default now(),
  unique(session_id,kind,plan,entry)
);
create index business_interest_retention on public.business_interest(created_at);
create index business_interest_rate on public.business_interest(visitor_hash,created_at);
-- Durable system events are separate from anonymous browser interest. Only the
-- database can record payment/access stages; no client success-page conversions.
do $$ declare id_type text; begin
  select format_type(atttypid,atttypmod) into id_type from pg_attribute where attrelid='public.places'::regclass and attname='id';
  execute format('create table public.business_milestones (
    kind text not null check (kind in (''claim_submitted'',''claim_approved'',''checkout_started'',''subscription_active'',''first_profile_published'',''paid_period_extended'')),
    place_id %s not null references public.places(id) on delete cascade,
    reference text not null, created_at timestamptz not null default now(),
    primary key(kind,place_id,reference))', id_type);
end $$;
create index business_milestones_period on public.business_milestones(created_at);
do $$ declare t text; begin
  foreach t in array array['business_interest','business_milestones'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.record_business_interest(p_event_id uuid,p_session_id uuid,p_kind text,p_plan text,p_entry text,p_device text,p_hash text)
returns void language plpgsql security definer set search_path='' as $$ begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid hash.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hash,29));
  delete from public.business_interest where created_at < now()-interval '90 days';
  if (select count(*) from public.business_interest where visitor_hash=p_hash and created_at>now()-interval '1 day') >= 100 then raise exception 'Please try again tomorrow.'; end if;
  insert into public.business_interest(event_id,session_id,kind,plan,entry,device,visitor_hash) values(p_event_id,p_session_id,p_kind,p_plan,p_entry,p_device,p_hash) on conflict do nothing;
end $$;
revoke all on function public.record_business_interest(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_business_interest(uuid,uuid,text,text,text,text,text) to service_role;

create function place_management_private.record_business_milestone() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; ref text;
begin
  if tg_table_name='place_claims' then
    if tg_op='INSERT' then k:='claim_submitted'; else if new.status='approved' and old.status is distinct from 'approved' then k:='claim_approved'; end if; end if;
    ref:=new.id::text;
  elsif tg_table_name='place_subscriptions' then
    if new.checkout_session_id is not null and (tg_op='INSERT' or new.checkout_session_id is distinct from old.checkout_session_id) then
      insert into public.business_milestones(kind,place_id,reference) values('checkout_started',new.place_id,new.checkout_session_id) on conflict do nothing;
    end if;
    if new.status='active' and new.paid_until>now() and new.stripe_subscription_id is not null then
      if tg_op='INSERT' or old.stripe_subscription_id is distinct from new.stripe_subscription_id or old.paid_until is null then
        insert into public.business_milestones(kind,place_id,reference) values('subscription_active',new.place_id,new.stripe_subscription_id) on conflict do nothing;
      end if;
      if tg_op='UPDATE' and old.stripe_subscription_id=new.stripe_subscription_id and old.paid_until is not null and new.paid_until>old.paid_until then
        insert into public.business_milestones(kind,place_id,reference) values('paid_period_extended',new.place_id,new.paid_until::text) on conflict do nothing;
      end if;
    end if;
  elsif tg_table_name in ('place_revisions','place_growth_revisions') then
    -- Count an approved, entitled owner's publish, excluding administrative edits.
    if new.actor_id is not null and exists(select 1 from public.place_memberships where place_id::text=new.place_id::text and user_id=new.actor_id)
      and not exists(select 1 from public.site_admins where user_id=new.actor_id)
      and place_management_private.subscription_active(new.place_id::text) then
      k:='first_profile_published'; ref:='first';
    end if;
  end if;
  if k is not null then insert into public.business_milestones(kind,place_id,reference) select k,p.id,ref from public.places p where p.id::text=new.place_id::text on conflict do nothing; end if;
  return new;
end $$;
create trigger business_claim_milestones after insert or update of status on public.place_claims for each row execute function place_management_private.record_business_milestone();
create trigger business_billing_milestones after insert or update on public.place_subscriptions for each row execute function place_management_private.record_business_milestone();
create trigger business_profile_milestone after insert on public.place_revisions for each row execute function place_management_private.record_business_milestone();
create trigger business_highlights_milestone after insert on public.place_growth_revisions for each row execute function place_management_private.record_business_milestone();

create function public.admin_business_overview() returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if not place_management_private.confirmed_user() or not place_management_private.is_admin() then raise exception 'Administrator access required.'; end if;
  return jsonb_build_object('from',now()-interval '30 days','through',now(),
    'interest',coalesce((select jsonb_agg(to_jsonb(x)) from (select kind,plan,entry,device,count(distinct session_id) sessions from public.business_interest where created_at>=now()-interval '30 days' group by kind,plan,entry,device order by kind,plan,entry,device) x),'[]'::jsonb),
    'milestones',coalesce((select jsonb_agg(to_jsonb(x)) from (select kind,count(distinct place_id) places from public.business_milestones where created_at>=now()-interval '30 days' group by kind order by kind) x),'[]'::jsonb));
end $$;
revoke all on function public.admin_business_overview() from public,anon;
grant execute on function public.admin_business_overview() to authenticated;
revoke all on function place_management_private.record_business_milestone() from public,anon,authenticated;
-- Freeze the profile context with each report payload so retry content stays stable.
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
