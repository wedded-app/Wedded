-- Vendor photos: the public bucket, who can add files and rows, and that
-- photos of unpublished vendors stay hidden.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'vendor-media' $$,
  $$ values (true, 5242880::bigint) $$,
  'vendor-media is a public bucket with a 5 MB limit'
);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('60000000-0000-4000-8000-000000000001', 'media-published', 'published', 'Media Published', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)'),
  ('60000000-0000-4000-8000-000000000002', 'media-draft', 'draft', 'Media Draft', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)');

insert into public.vendor_media (vendor_id, storage_path, width, height, is_cover, sort_order) values
  ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001/a', 1600, 1067, true, 1),
  ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001/b', 1600, 1067, false, 2),
  ('60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002/c', 1600, 1067, true, 1);

select throws_ok(
  $$ insert into public.vendor_media (vendor_id, storage_path, width, height, is_cover) values
     ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001/d', 100, 100, true) $$,
  '23505', null, 'A vendor has only one cover photo'
);

select throws_ok(
  $$ insert into public.vendor_media (vendor_id, storage_path, width, height) values
     ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002/e', 100, 100) $$,
  '23514', null, 'A photo''s files must sit in its own vendor''s folder'
);

set local role anon;

select is(
  (select count(*)::int from public.vendor_media where vendor_id in (
     '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002')),
  2,
  'Logged-out users see photos of published vendors only'
);

select is(
  (select cover_path from public.search_vendors(query => 'Media Published')),
  '60000000-0000-4000-8000-000000000001/a',
  'Search results carry the vendor''s cover photo'
);

select throws_ok(
  $$ insert into public.vendor_media (vendor_id, storage_path, width, height) values
     ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001/f', 100, 100) $$,
  '42501', null, 'Logged-out users cannot add photos'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('vendor-media', 'hack/400.webp') $$,
  '42501', null, 'Logged-out users cannot upload files to vendor-media'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('vendor-media', 'hack/400.webp') $$,
  '42501', null, 'Signed-in users cannot upload files to vendor-media'
);

select throws_ok(
  $$ delete from public.vendor_media $$,
  '42501', null, 'Signed-in users cannot remove photos'
);

reset role;

select * from finish();
rollback;
