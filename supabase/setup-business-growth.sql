-- Run after 202610270001_business_growth.sql. Enable pg_cron first.
-- Mandatory before enabling activity collection: enforces the published retention policy.
begin;
select cron.schedule('place-activity-retention', '41 5 * * *', 'select public.prune_place_activity();');

-- Reuse the existing debounced website build queue when it is installed.
-- Otherwise the scheduled GitHub workflow still checks for growth changes daily.
do $$ begin
  if to_regprocedure('site_build_private.mark_dirty()') is not null then
    execute 'drop trigger if exists queue_growth_site_rebuild on public.place_growth_profiles';
    execute 'create trigger queue_growth_site_rebuild after insert or update or delete on public.place_growth_profiles for each statement execute function site_build_private.mark_dirty()';
  end if;
end $$;
commit;
