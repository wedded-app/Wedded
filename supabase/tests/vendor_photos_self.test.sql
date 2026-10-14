-- Vendors add and arrange their own photos: only their people, only in their
-- own folder, only once the files are there; one cover; order and event tags.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1400000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'photo-owner@example.com'),
  ('a1400000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'photo-stranger@example.com');
insert into public.vendors (id, slug, status, name, city, location) values
  ('b1400000-0000-4000-8000-000000000001', 'photo-hall', 'draft', 'Photo Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('b1400000-0000-4000-8000-000000000002', 'photo-other', 'published', 'Photo Other', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b1400000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- The three files of a photo, as the app uploads them
create function pg_temp.upload(vendor uuid, photo uuid) returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner)
  select 'vendor-media', vendor::text || '/' || photo::text || '/' || size || '.webp', (select auth.uid())
  from unnest(array['400', '1080', '1600']) as size;
$$;

set local role authenticated;
select pg_temp.as_user('a1400000-0000-4000-8000-00000000000e');

-- Uploading -------------------------------------------------------------------------------

select lives_ok(
  $$ select pg_temp.upload('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000001') $$,
  'A vendor''s people upload the three sizes to their own folder'
);
select throws_ok(
  $$ select pg_temp.upload('b1400000-0000-4000-8000-000000000002', 'f1400000-0000-4000-8000-000000000009') $$,
  '42501', null,
  'but not to another vendor''s'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('vendor-media', 'b1400000-0000-4000-8000-000000000001/f1400000-0000-4000-8000-000000000001/huge.png', (select auth.uid())) $$,
  '42501', null,
  'and only the three WebP sizes'
);

-- Saving ----------------------------------------------------------------------------------

select throws_ok(
  $$ select public.add_vendor_photo('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000002', 1600, 1200) $$,
  'P0002', 'files_missing',
  'A photo is saved only once its files are uploaded'
);
create temp table first_photo as
  select public.add_vendor_photo('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000001', 1600, 1200, 'reception') as id;
select results_eq(
  $$ select storage_path, is_cover, sort_order, event_slug from public.vendor_media $$,
  $$ values ('b1400000-0000-4000-8000-000000000001/f1400000-0000-4000-8000-000000000001', true, 0::smallint, 'reception') $$,
  'The first photo is saved as the cover, and the vendor sees it while still a draft'
);
select throws_ok(
  $$ select public.add_vendor_photo('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000001', 1600, 1200) $$,
  '23505', 'already_added',
  'The same photo once'
);

select pg_temp.upload('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000002');
select pg_temp.upload('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000003');
create temp table more_photos as
  select public.add_vendor_photo('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000002', 1200, 1600) as second_id,
         public.add_vendor_photo('b1400000-0000-4000-8000-000000000001', 'f1400000-0000-4000-8000-000000000003', 1600, 1600) as third_id;
select results_eq(
  $$ select count(*)::int, count(*) filter (where is_cover)::int, max(sort_order)::int from public.vendor_media $$,
  $$ values (3, 1, 2) $$,
  'Later photos go to the end, still one cover'
);

-- Arranging -------------------------------------------------------------------------------

select lives_ok(
  $$ select public.set_vendor_cover((select third_id from more_photos)) $$,
  'They pick another cover'
);
select is(
  (select id from public.vendor_media where is_cover),
  (select third_id from more_photos),
  'Only that one is the cover'
);
select lives_ok(
  $$ select public.reorder_vendor_photos('b1400000-0000-4000-8000-000000000001',
       array[(select third_id from more_photos), (select id from first_photo)]) $$,
  'They put the photos in order'
);
select results_eq(
  $$ select id from public.vendor_media order by sort_order $$,
  $$ values ((select third_id from more_photos)), ((select id from first_photo)), ((select second_id from more_photos)) $$,
  'The ones named first, the rest after'
);
select lives_ok(
  $$ select public.tag_vendor_photo((select second_id from more_photos), 'jaago') $$,
  'They tag a photo with its event'
);

-- Removing --------------------------------------------------------------------------------

select is(
  public.remove_vendor_photo((select third_id from more_photos)),
  'b1400000-0000-4000-8000-000000000001/f1400000-0000-4000-8000-000000000003',
  'Removing gives back the folder for the app to delete'
);
select is(
  (select id from public.vendor_media where is_cover),
  (select id from first_photo),
  'Removing the cover makes the next photo the cover'
);

-- Strangers -------------------------------------------------------------------------------

select pg_temp.as_user('a1400000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.remove_vendor_photo((select id from first_photo)) $$,
  '42501', 'not_allowed',
  'Someone else can''t remove a vendor''s photo'
);
select is(
  (select count(*)::int from public.vendor_media where vendor_id = 'b1400000-0000-4000-8000-000000000001'),
  0,
  'or see a draft vendor''s photos'
);
reset role;

select * from finish();
rollback;
