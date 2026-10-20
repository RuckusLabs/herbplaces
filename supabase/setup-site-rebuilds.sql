-- OPTIONAL: run in Supabase SQL Editor only after the updated deploy.yml is on main.
-- Enable pg_net and pg_cron. In the Vault dashboard, save a fine-grained GitHub
-- token as site_build_github_token, scoped to RuckusLabs/herbplaces, Actions: write.
-- This file contains no credentials. Do not put the token into SQL history.
begin;

do $$
begin
  if to_regnamespace('net') is null or to_regnamespace('cron') is null then
    raise exception 'Enable pg_net and pg_cron before setting up site rebuilds.';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name = 'site_build_github_token' and length(decrypted_secret) >= 20) then
    raise exception 'Save site_build_github_token through the Supabase Vault dashboard first.';
  end if;
end $$;

create schema if not exists site_build_private;
revoke all on schema site_build_private from public, anon, authenticated, service_role;
create table if not exists site_build_private.queue (
  id boolean primary key default true check(id),
  dirty_at timestamptz,
  request_id bigint,
  request_started_at timestamptz,
  last_attempt_at timestamptz,
  last_accepted_at timestamptz,
  last_error text
);
alter table site_build_private.queue enable row level security;
revoke all on site_build_private.queue from public, anon, authenticated, service_role;
insert into site_build_private.queue(id) values(true) on conflict do nothing;

create or replace function site_build_private.mark_dirty() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A bulk insert/update marks one durable job, not one workflow per row.
  insert into site_build_private.queue(id, dirty_at) values(true, clock_timestamp())
  on conflict(id) do update set dirty_at = excluded.dirty_at;
  return null;
end $$;
revoke all on function site_build_private.mark_dirty() from public, anon, authenticated, service_role;

drop trigger if exists queue_site_rebuild on public.places;
create trigger queue_site_rebuild after insert or update or delete on public.places
  for each statement execute function site_build_private.mark_dirty();

create or replace function site_build_private.dispatch() returns void
language plpgsql security definer set search_path = '' as $$
declare
  job site_build_private.queue%rowtype;
  response record;
  token text;
  next_request bigint;
begin
  select * into job from site_build_private.queue where id for update skip locked;
  if not found then return; end if;
  if job.request_id is not null then
    select status_code, timed_out into response from net._http_response where id = job.request_id;
    if found then
      if response.status_code between 200 and 299 and not coalesce(response.timed_out, false) then
        update site_build_private.queue set
          dirty_at = case when dirty_at <= request_started_at then null else dirty_at end,
          request_id = null, last_accepted_at = clock_timestamp(), last_error = null where id;
      else
        update site_build_private.queue set request_id = null,
          last_error = 'GitHub dispatch failed (HTTP ' || coalesce(response.status_code::text, 'timeout') || '). Check the token and workflow.' where id;
      end if;
    elsif job.request_started_at < clock_timestamp() - interval '3 minutes' then
      update site_build_private.queue set request_id = null, last_error = 'No dispatch response received; retry pending.' where id;
    else return;
    end if;
    select * into job from site_build_private.queue where id;
  end if;
  if job.dirty_at is null or job.dirty_at > clock_timestamp() - interval '30 seconds' then return; end if;
  if job.last_error is not null and job.last_attempt_at > clock_timestamp() - interval '5 minutes' then return; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'site_build_github_token';
  if token is null then
    update site_build_private.queue set last_attempt_at = clock_timestamp(), last_error = 'GitHub token is missing from Vault.' where id;
    return;
  end if;
  next_request := net.http_post(
    url := 'https://api.github.com/repos/RuckusLabs/herbplaces/actions/workflows/deploy.yml/dispatches',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/vnd.github+json',
      'User-Agent', 'Little-Herb-Places-Build', 'X-GitHub-Api-Version', '2026-03-10', 'Authorization', 'Bearer ' || token),
    body := jsonb_build_object('ref', 'main'), timeout_milliseconds := 10000
  );
  update site_build_private.queue set request_id = next_request, request_started_at = clock_timestamp(),
    last_attempt_at = clock_timestamp() where id;
exception when others then
  update site_build_private.queue set request_id = null, last_attempt_at = clock_timestamp(),
    last_error = 'Dispatch could not be queued. Check pg_net and Vault configuration.' where id;
end $$;
revoke all on function site_build_private.dispatch() from public, anon, authenticated, service_role;

-- Rerunning this setup replaces the same named schedule rather than duplicating it.
select cron.schedule('little-herb-places-rebuild', '* * * * *', 'select site_build_private.dispatch();');
commit;

-- Monitor with a database administrator; no token is included in this result:
-- select dirty_at, request_id, last_attempt_at, last_accepted_at, last_error
-- from site_build_private.queue;
-- last_accepted_at confirms GitHub accepted the request, not that deployment passed.
-- The GitHub Actions run shows the final build/deployment outcome.
