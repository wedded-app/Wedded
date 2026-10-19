-- Reels: posting (own folder, consent, tags), the feeds, follows, likes,
-- comments, blocking, tag approval by the vendor, and reports.

begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- People: Asha (a family), Bal (a family who follows), Cee (blocks Asha), and
-- Dev, who runs Reel Hall
insert into auth.users (id, instance_id, aud, role, email) values
  ('a7000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-reels@example.com'),
  ('b7000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bal-reels@example.com'),
  ('c7000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cee-reels@example.com'),
  ('d7000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-reels@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a7000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550301'),
  ('b7000000-0000-4000-8000-00000000000b', 'Bal Singh', 'Yuba City', '+15305550302'),
  ('c7000000-0000-4000-8000-00000000000c', 'Cee Gill', 'Fremont', '+15105550303'),
  ('d7000000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fremont', '+15105550304');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('97000000-0000-4000-8000-000000000001', 'reel-hall', 'published', 'Reel Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('97000000-0000-4000-8000-000000000002', 'reel-dhol', 'published', 'Reel Dhol', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('97000000-0000-4000-8000-000000000003', 'reel-draft', 'draft', 'Reel Draft', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('97000000-0000-4000-8000-000000000001', 'd7000000-0000-4000-8000-00000000000d');
-- The uploaded files
insert into storage.objects (bucket_id, name, owner) values
  ('reels', 'a7000000-0000-4000-8000-00000000000a/jaago.mp4', 'a7000000-0000-4000-8000-00000000000a'),
  ('reels', 'd7000000-0000-4000-8000-00000000000d/hall.mp4', 'd7000000-0000-4000-8000-00000000000d');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

set local role authenticated;

-- Posting ------------------------------------------------------------------------------------------

select pg_temp.as_user('a7000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.create_reel('a7000000-0000-4000-8000-00000000000a/jaago.mp4', null, 20, 1080, 1920,
       'Our jaago!', 'jaago', array['97000000-0000-4000-8000-000000000002']::uuid[], null, false) $$,
  '22023', 'consent_required',
  'Posting needs the "everyone in it is okay with this" tick'
);
select throws_ok(
  $$ select public.create_reel('d7000000-0000-4000-8000-00000000000d/hall.mp4', null, 20, 1080, 1920,
       null, null, '{}'::uuid[], null, true) $$,
  '42501', 'not_your_file',
  'and only your own uploaded file'
);
select throws_ok(
  $$ select public.create_reel('a7000000-0000-4000-8000-00000000000a/jaago.mp4', null, 20, 1080, 1920,
       null, null, array['97000000-0000-4000-8000-000000000003']::uuid[], null, true) $$,
  'P0002', 'vendor_not_found',
  'Only listed vendors can be tagged'
);
select throws_ok(
  $$ select public.create_reel('a7000000-0000-4000-8000-00000000000a/jaago.mp4', null, 20, 1080, 1920,
       null, null, '{}'::uuid[], '97000000-0000-4000-8000-000000000001', true) $$,
  '42501', 'not_allowed',
  'Families cannot post as a vendor'
);
insert into pg_temp.ids
select 'family_reel', public.create_reel('a7000000-0000-4000-8000-00000000000a/jaago.mp4', null, 20, 1080, 1920,
  '  Our jaago!  ', 'jaago', array['97000000-0000-4000-8000-000000000002']::uuid[], null, true)::text;
select results_eq(
  $$ select caption, status from public.reels where id = (select value::uuid from pg_temp.ids where name = 'family_reel') $$,
  $$ values ('Our jaago!'::text, 'live'::text) $$,
  'A family posts a clip from their wedding'
);
select is(
  (select status from public.reel_vendor_tags where vendor_id = '97000000-0000-4000-8000-000000000002'),
  'pending',
  'and the vendor they tagged waits for the vendor to approve'
);

select pg_temp.as_user('d7000000-0000-4000-8000-00000000000d');
insert into pg_temp.ids
select 'vendor_reel', public.create_reel('d7000000-0000-4000-8000-00000000000d/hall.mp4', null, 15, 1080, 1920,
  'Our new stage', 'reception', '{}'::uuid[], '97000000-0000-4000-8000-000000000001', true)::text;
select results_eq(
  $$ select vendor_slug, vendor_name from public.reels_feed('for_you')
     where id = (select value::uuid from pg_temp.ids where name = 'vendor_reel') $$,
  $$ values ('reel-hall'::text, 'Reel Hall'::text) $$,
  'A vendor posts their work, shown as the business'
);

-- Feeds ------------------------------------------------------------------------------------------------

set local role anon;
select is(
  (select count(*)::int from public.reels_feed('for_you')),
  2,
  'Anyone can scroll For you, signed in or not'
);
select results_eq(
  $$ select author_name, tags -> 0 ->> 'slug' from public.reels_feed('for_you')
     where id = (select value::uuid from pg_temp.ids where name = 'family_reel') $$,
  $$ values ('Asha K.'::text, 'reel-dhol'::text) $$,
  'with the poster as "Asha K." and the tagged vendors'
);
set local role authenticated;

-- Following -------------------------------------------------------------------------------------------

select pg_temp.as_user('b7000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.reels_feed('following')), 0, 'Following is empty until you follow someone');
insert into public.follows (followee_vendor_id) values ('97000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.reels_feed('following')),
  1,
  'Following a vendor brings their reels into Following'
);
insert into public.follows (followee_user_id) values ('a7000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.reels_feed('following')), 2, 'and following a person brings theirs');
select throws_ok(
  $$ insert into public.follows (followee_user_id) values ('b7000000-0000-4000-8000-00000000000b') $$,
  '23514', null,
  'Nobody follows themselves'
);
select results_eq(
  $$ select follower_count, following from public.reel_person('a7000000-0000-4000-8000-00000000000a') $$,
  $$ values (1::bigint, true) $$,
  'A person''s page counts their followers'
);

-- Likes and comments --------------------------------------------------------------------------------

insert into public.reel_likes (reel_id) select value::uuid from pg_temp.ids where name = 'family_reel';
select results_eq(
  $$ select like_count, liked from public.reels_feed('for_you')
     where id = (select value::uuid from pg_temp.ids where name = 'family_reel') $$,
  $$ values (1::bigint, true) $$,
  'Likes count, and the feed knows you liked it'
);
select throws_ok(
  $$ insert into public.reel_likes (reel_id, user_id)
     select value::uuid, 'c7000000-0000-4000-8000-00000000000c' from pg_temp.ids where name = 'family_reel' $$,
  '42501', null,
  'Nobody likes on someone else''s behalf'
);
insert into pg_temp.ids
select 'comment', public.add_reel_comment((select value::uuid from pg_temp.ids where name = 'family_reel'), '  So much fun!  ')::text;
select results_eq(
  $$ select name, body from public.reel_comments_list((select value::uuid from pg_temp.ids where name = 'family_reel')) $$,
  $$ values ('Bal S.'::text, 'So much fun!'::text) $$,
  'Comments show with "Bal S."'
);

select pg_temp.as_user('a7000000-0000-4000-8000-00000000000a');
select public.hide_reel_comment((select value::uuid from pg_temp.ids where name = 'comment'));
select is(
  (select count(*)::int from public.reel_comments_list((select value::uuid from pg_temp.ids where name = 'family_reel'))),
  0,
  'The poster can hide a comment on their reel'
);
reset role;
select is(
  (select hidden_by from public.reel_comments where id = (select value::uuid from pg_temp.ids where name = 'comment')),
  'a7000000-0000-4000-8000-00000000000a'::uuid,
  'and the comment remembers who hid it'
);
set local role authenticated;

-- Blocking ----------------------------------------------------------------------------------------------

select pg_temp.as_user('c7000000-0000-4000-8000-00000000000c');
insert into public.user_blocks (blocked_id) values ('a7000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.reels_feed('for_you') where author_id = 'a7000000-0000-4000-8000-00000000000a'),
  0,
  'Blocking someone hides their reels from you'
);
select pg_temp.as_user('a7000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.reel_person('c7000000-0000-4000-8000-00000000000c')),
  0,
  'and hides you from them'
);
select pg_temp.as_user('c7000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.add_reel_comment((select value::uuid from pg_temp.ids where name = 'family_reel'), 'hi') $$,
  'P0002', 'reel_not_found',
  'Nobody comments across a block'
);

-- Tag approval ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a7000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.decide_reel_tag((select value::uuid from pg_temp.ids where name = 'family_reel'),
       '97000000-0000-4000-8000-000000000002', true) $$,
  '42501', 'not_allowed',
  'Only the vendor''s own people decide on a tag'
);
reset role;
insert into public.vendor_members (vendor_id, user_id) values
  ('97000000-0000-4000-8000-000000000002', 'd7000000-0000-4000-8000-00000000000d');
set local role authenticated;
select pg_temp.as_user('d7000000-0000-4000-8000-00000000000d');
select public.decide_reel_tag((select value::uuid from pg_temp.ids where name = 'family_reel'),
  '97000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::int from public.reels_feed('vendor', null, 10, null, '97000000-0000-4000-8000-000000000002')),
  1,
  'An approved tag puts the family''s reel on the vendor''s page'
);
reset role;
select is(
  (select decided_by from public.reel_vendor_tags
   where reel_id = (select value::uuid from pg_temp.ids where name = 'family_reel')
     and vendor_id = '97000000-0000-4000-8000-000000000002'),
  'd7000000-0000-4000-8000-00000000000d'::uuid,
  'and the tag remembers who approved it'
);
set local role authenticated;

-- Reports -----------------------------------------------------------------------------------------------

select lives_ok(
  $$ select public.report_reel_content(p_reel_id => (select value::uuid from pg_temp.ids where name = 'family_reel'),
       p_reason => 'privacy') $$,
  'Anyone signed in can report a reel'
);
select throws_ok(
  $$ select count(*) from public.reports $$,
  '42501', null,
  'but nobody can read reports through the app'
);

select * from finish();
rollback;
