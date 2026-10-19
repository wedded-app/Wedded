-- Stories: posting (own folder, consent, as a business, daily limit), the
-- 24-hour feed, follows, blocking, hiding, deleting and reporting.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- People: Asha (a family), Bal (follows Asha), Cee (blocks Asha), and Dev,
-- who runs Story Hall
insert into auth.users (id, instance_id, aud, role, email) values
  ('a8000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-stories@example.com'),
  ('b8000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bal-stories@example.com'),
  ('c8000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cee-stories@example.com'),
  ('d8000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-stories@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a8000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550401'),
  ('b8000000-0000-4000-8000-00000000000b', 'Bal Singh', 'Yuba City', '+15305550402'),
  ('c8000000-0000-4000-8000-00000000000c', 'Cee Gill', 'Fremont', '+15105550403'),
  ('d8000000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fremont', '+15105550404');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('98000000-0000-4000-8000-000000000001', 'story-hall', 'published', 'Story Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('98000000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-00000000000d');
insert into storage.objects (bucket_id, name, owner) values
  ('reels', 'a8000000-0000-4000-8000-00000000000a/story-mehndi.jpg', 'a8000000-0000-4000-8000-00000000000a'),
  ('reels', 'd8000000-0000-4000-8000-00000000000d/story-setup.mp4', 'd8000000-0000-4000-8000-00000000000d'),
  ('reels', 'c8000000-0000-4000-8000-00000000000c/story-cee.jpg', 'c8000000-0000-4000-8000-00000000000c');
-- Asha's story from two days ago, gone from the feeds
insert into public.stories (author_id, kind, media_path, created_at) values
  ('a8000000-0000-4000-8000-00000000000a', 'photo', 'a8000000-0000-4000-8000-00000000000a/old.jpg', now() - interval '2 days');
insert into public.follows (follower_id, user_id) values
  ('b8000000-0000-4000-8000-00000000000b', 'a8000000-0000-4000-8000-00000000000a');
insert into public.user_blocks (blocker_id, blocked_id) values
  ('c8000000-0000-4000-8000-00000000000c', 'a8000000-0000-4000-8000-00000000000a');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value uuid);
grant all on pg_temp.ids to authenticated, anon;

set local role authenticated;

-- Posting ------------------------------------------------------------------------------------------

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.create_story('photo', 'a8000000-0000-4000-8000-00000000000a/story-mehndi.jpg',
       null, null, 1080, 1920, null, null, false) $$,
  '22023', 'consent_required',
  'Posting a story needs the "everyone in it is okay with this" tick'
);
select throws_ok(
  $$ select public.create_story('video', 'd8000000-0000-4000-8000-00000000000d/story-setup.mp4',
       null, 12, 1080, 1920, null, null, true) $$,
  '42501', 'not_your_file',
  'and only your own file'
);
select throws_ok(
  $$ select public.create_story('photo', 'a8000000-0000-4000-8000-00000000000a/never-sent.jpg',
       null, null, 1080, 1920, null, null, true) $$,
  'P0002', 'media_not_uploaded',
  'that has been uploaded'
);
select throws_ok(
  $$ select public.create_story('photo', 'a8000000-0000-4000-8000-00000000000a/story-mehndi.jpg',
       null, null, 1080, 1920, null, '98000000-0000-4000-8000-000000000001', true) $$,
  '42501', 'not_allowed',
  'Only a business''s own people post as it'
);
insert into pg_temp.ids
select 'asha', public.create_story('photo', 'a8000000-0000-4000-8000-00000000000a/story-mehndi.jpg',
  null, 99, 1080, 1920, '  Mehndi night!  ', null, true);
select is(
  (select row(kind, duration_s, caption)::text from public.stories
   where id = (select value from pg_temp.ids where name = 'asha')),
  row('photo', null::numeric, 'Mehndi night!')::text,
  'A photo story keeps no clip length and a trimmed caption'
);

select pg_temp.as_user('d8000000-0000-4000-8000-00000000000d');
insert into pg_temp.ids
select 'hall', public.create_story('video', 'd8000000-0000-4000-8000-00000000000d/story-setup.mp4',
  null, 12.5, 1080, 1920, null, '98000000-0000-4000-8000-000000000001', true);
select is(
  (select row(vendor_slug, vendor_name, author_name, is_mine)::text from public.stories_feed()
   where id = (select value from pg_temp.ids where name = 'hall')),
  row('story-hall', 'Story Hall', 'Dev S.', true)::text,
  'A business''s story shows as the business'
);

-- The feed -----------------------------------------------------------------------------------------

reset role;
set local role anon;
select pg_temp.as_user(null);
select is(
  (select count(*)::int from public.stories_feed()
   where author_id in ('a8000000-0000-4000-8000-00000000000a', 'd8000000-0000-4000-8000-00000000000d')), 2,
  'Anyone can watch today''s stories, not ones over a day old'
);

set local role authenticated;
select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select author_name, following from public.stories_feed()
     where author_id in ('a8000000-0000-4000-8000-00000000000a', 'd8000000-0000-4000-8000-00000000000d')
     order by author_name $$,
  $$ values ('Asha K.'::text, true), ('Dev S.', false) $$,
  'Bal sees who he follows'
);

select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
insert into pg_temp.ids
select 'cee', public.create_story('photo', 'c8000000-0000-4000-8000-00000000000c/story-cee.jpg',
  null, null, null, null, null, null, true);
select is(
  (select count(*)::int from public.stories_feed()
   where author_id = 'a8000000-0000-4000-8000-00000000000a'), 0,
  'Cee blocked Asha, so Asha''s story is hidden from her'
);
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.stories_feed()
   where author_id = 'c8000000-0000-4000-8000-00000000000c'), 0,
  'and Cee''s from Asha'
);
select is(
  (select count(*)::int from public.stories where author_id = 'a8000000-0000-4000-8000-00000000000a'), 2,
  'Asha still reads her own expired story, to clear it away'
);

-- Reports, hiding and deleting ---------------------------------------------------------------------

select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ select public.report_reel_content(p_story_id => (select value from pg_temp.ids where name = 'hall'),
       p_reason => 'spam') $$,
  'A story can be reported'
);
select lives_ok(
  $$ select public.report_reel_content(p_reel_id => null, p_user_id => 'd8000000-0000-4000-8000-00000000000d',
       p_reason => 'harassment') $$,
  'and reporting a person still works'
);
delete from public.stories where id = (select value from pg_temp.ids where name = 'asha');
reset role;
select is(
  (select count(*)::int from public.reel_reports where story_id = (select value from pg_temp.ids where name = 'hall')), 1,
  'The founders get the story''s report'
);
select is(
  (select count(*)::int from public.stories where id = (select value from pg_temp.ids where name = 'asha')), 1,
  'Bal can''t delete Asha''s story'
);

update public.stories set status = 'hidden' where id = (select value from pg_temp.ids where name = 'hall');
set local role anon;
select pg_temp.as_user(null);
select is(
  (select count(*)::int from public.stories_feed() where id = (select value from pg_temp.ids where name = 'hall')), 0,
  'A story the founders hid leaves the feed'
);

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
delete from public.stories where id = (select value from pg_temp.ids where name = 'asha');
select is(
  (select count(*)::int from public.stories_feed() where id = (select value from pg_temp.ids where name = 'asha')), 0,
  'Asha deletes her own story'
);

-- 30 a day
reset role;
insert into public.stories (author_id, kind, media_path)
select 'a8000000-0000-4000-8000-00000000000a', 'photo', 'a8000000-0000-4000-8000-00000000000a/many-' || n || '.jpg'
from generate_series(1, 30) n;
set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.create_story('photo', 'a8000000-0000-4000-8000-00000000000a/story-mehndi.jpg',
       null, null, 1080, 1920, null, null, true) $$,
  'P0001', 'story_limit',
  'At most 30 stories a day'
);

select * from finish();
rollback;
