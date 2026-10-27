-- Storage deletes a file with DELETE ... RETURNING, so a file can be deleted
-- only if it can be seen too: the people who may delete a website photo, a
-- vendor's photo or their own reel file see it, and nobody else does.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- People: Asha plans a wedding, runs a vendor and posts reels; Dev is a stranger
insert into auth.users (id, instance_id, aud, role, email) values
  ('a9200000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-st@example.com'),
  ('d9200000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-st@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

create function pg_temp.val(p_name text) returns text language sql as $$
  select value from pg_temp.ids where name = p_name;
$$;

-- What the files in a folder look like to the caller, and Storage's own delete
-- (the Storage API sets storage.allow_delete_query; plain SQL deletes are refused)
create function pg_temp.seen(p_bucket text, p_folder text) returns integer language sql as $$
  select count(*)::integer from storage.objects where bucket_id = p_bucket and name like p_folder || '/%';
$$;
create function pg_temp.storage_delete(p_bucket text, p_folder text) returns integer language plpgsql as $$
declare
  deleted integer;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  with d as (
    delete from storage.objects where bucket_id = p_bucket and name like p_folder || '/%' returning 1
  )
  select count(*)::integer into deleted from d;
  return deleted;
end;
$$;

-- Asha's wedding and its website
set local role authenticated;
select pg_temp.as_user('a9200000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'wedding', public.create_wedding(p_title => 'Asha & Ravi', p_events => array['reception'])::text;
select public.create_site(pg_temp.val('wedding')::uuid);
reset role;

-- Files as Storage leaves them after uploads: an old website photo, the cover,
-- a photo of Asha's vendor, and one of Asha's reels
insert into pg_temp.ids values
  ('old', pg_temp.val('wedding') || '/0a000000-0000-4000-8000-000000000001'),
  ('cover_id', '0a000000-0000-4000-8000-000000000002'),
  ('vendor', (select id::text from public.vendors order by slug limit 1)),
  ('reel', 'a9200000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'cover', pg_temp.val('wedding') || '/' || pg_temp.val('cover_id');
insert into pg_temp.ids select 'vendor_photo', pg_temp.val('vendor') || '/0a000000-0000-4000-8000-000000000003';
insert into storage.objects (bucket_id, name)
select 'site-media', folder || '/' || size || '.webp'
from unnest(array[pg_temp.val('old'), pg_temp.val('cover')]) as folder, unnest(array['400', '1080', '1600']) as size
union all
select 'vendor-media', pg_temp.val('vendor_photo') || '/' || size || '.webp'
from unnest(array['400', '1080', '1600']) as size
union all
select 'reels', pg_temp.val('reel') || '/clip.mp4';
insert into public.vendor_members (vendor_id, user_id)
values (pg_temp.val('vendor')::uuid, 'a9200000-0000-4000-8000-00000000000a');

set local role authenticated;
select pg_temp.as_user('a9200000-0000-4000-8000-00000000000a');
select public.set_site_cover(pg_temp.val('wedding')::uuid, pg_temp.val('cover_id')::uuid);

-- Dev sees and deletes none of them
select pg_temp.as_user('d9200000-0000-4000-8000-00000000000d');
select is(pg_temp.seen('site-media', pg_temp.val('old')), 0, 'A stranger doesn''t see a wedding''s website photos');
select is(pg_temp.storage_delete('site-media', pg_temp.val('old')), 0, 'and can''t delete them');
select is(pg_temp.storage_delete('vendor-media', pg_temp.val('vendor_photo')), 0, 'A stranger can''t delete a vendor''s photos');
select is(pg_temp.storage_delete('reels', pg_temp.val('reel')), 0, 'A stranger can''t delete someone''s reel files');

-- Asha deletes what she removed in the app
select pg_temp.as_user('a9200000-0000-4000-8000-00000000000a');
select is(pg_temp.seen('site-media', pg_temp.val('old')), 3, 'The owner sees the website''s old photo');
select is(pg_temp.storage_delete('site-media', pg_temp.val('old')), 3, 'and deletes its three sizes');
select is(pg_temp.storage_delete('site-media', pg_temp.val('cover')), 0, 'The cover can''t be deleted while it''s the cover');
select is(pg_temp.storage_delete('vendor-media', pg_temp.val('vendor_photo')), 3, 'A vendor''s people delete its removed photo');
select is(pg_temp.storage_delete('reels', pg_temp.val('reel')), 1, 'People delete their own reel files');

select * from finish();
rollback;
