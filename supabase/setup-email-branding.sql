-- Public logo only; all browser writes remain denied. No account data belongs here.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 262144, array['image/png'])
on conflict (id) do nothing;
drop policy if exists brand_assets_server_writes on storage.objects;
create policy brand_assets_server_writes on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'brand-assets') with check (bucket_id <> 'brand-assets');
commit;
