-- One read-only result so the CLI and SQL editor both return the full inventory.
select jsonb_build_object(
  'columns', (select jsonb_agg(to_jsonb(c)) from (
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name in ('places','profiles','favorites')
    order by table_name, ordinal_position
  ) c),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p
    where (schemaname = 'public' and tablename in ('places','profiles','favorites'))
       or (schemaname = 'storage' and tablename = 'objects')),
  'grants', (select jsonb_agg(to_jsonb(g)) from (
    select table_schema, table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where grantee in ('PUBLIC','anon','authenticated') and table_schema = 'public'
    order by table_name, grantee, privilege_type
  ) g),
  'row_security', (select jsonb_agg(jsonb_build_object('table', relname, 'enabled', relrowsecurity))
    from pg_class where relnamespace = 'public'::regnamespace and relname in ('places','profiles','favorites')),
  'management_tables', (select jsonb_agg(table_name) from information_schema.tables
    where table_schema = 'public' and table_name in (
      'site_admins','management_users','place_memberships','place_invitations','place_claims',
      'place_subscriptions','place_revisions','place_uploads','management_audit','billing_events'))
) as preflight;
