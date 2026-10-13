-- My business insights: search appearances, day by day numbers, seen to
-- booked, reply speed, what families ask for, comparisons that need 5 vendors
-- nearby, reel numbers and the listing checklist. Members only.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email) values
  ('ae000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ins-owner@example.com'),
  ('ae000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ins-stranger@example.com'),
  ('ae000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ins-family1@example.com'),
  ('ae000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ins-family2@example.com');

-- The caterer, four caterers nearby, one far away, and a draft
insert into public.vendors (id, slug, status, name, city, location, tagline, call_phone, languages) values
  ('be000000-0000-4000-8000-000000000001', 'ins-caterer', 'published', 'Ins Caterer', 'Yuba City',
   'SRID=4326;POINT(-121.6169 39.1404)', 'Punjabi food', '+15305550111', array['pa', 'en']);
insert into public.vendors (id, slug, status, name, city, location)
select ('be000000-0000-4000-8000-00000000001' || n)::uuid, 'ins-peer-' || n, 'published', 'Peer ' || n,
  'Marysville', 'SRID=4326;POINT(-121.5913 39.1457)'
from generate_series(1, 4) as n;
insert into public.vendors (id, slug, status, name, city, location) values
  ('be000000-0000-4000-8000-000000000021', 'ins-far', 'published', 'Far Caterer', 'Los Angeles', 'SRID=4326;POINT(-118.2437 34.0522)'),
  ('be000000-0000-4000-8000-000000000022', 'ins-draft', 'draft', 'Draft Caterer', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
-- Kids' entertainment has no sample vendors, so only these count as nearby.
-- The first also caters (its second type), so menus are on its checklist.
insert into public.vendor_categories (vendor_id, category_slug, position)
select id, 'kids-entertainment', 1 from public.vendors where slug like 'ins-%';
insert into public.vendor_categories (vendor_id, category_slug, position) values
  ('be000000-0000-4000-8000-000000000001', 'caterer', 2);
insert into public.vendor_members (vendor_id, user_id) values
  ('be000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

-- Search appearances --------------------------------------------------------------------

set local role anon;
select lives_ok(
  $$ select public.track_search_appearances(array[
       'be000000-0000-4000-8000-000000000001', 'be000000-0000-4000-8000-000000000001',
       'be000000-0000-4000-8000-000000000022']::uuid[]);
     select public.track_search_appearances(array['be000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'Anyone can count search appearances'
);
select throws_ok(
  $$ select public.track_search_appearances(array_fill('be000000-0000-4000-8000-000000000001'::uuid, array[51])) $$,
  '22023', 'too_many',
  'At most 50 at a time'
);
reset role;
select is(
  (select count from public.vendor_activity_daily
   where vendor_id = 'be000000-0000-4000-8000-000000000001' and kind = 'search'),
  2,
  'Once per page of results, however often the vendor is in it'
);
select is(
  (select count(*)::int from public.vendor_activity_daily
   where vendor_id = 'be000000-0000-4000-8000-000000000022'),
  0,
  'Drafts are not counted'
);

-- Numbers to look at ----------------------------------------------------------------------

insert into public.vendor_activity_daily (vendor_id, day, kind, count) values
  ('be000000-0000-4000-8000-000000000001', pg_temp.today(), 'view', 10),
  ('be000000-0000-4000-8000-000000000001', pg_temp.today() - 1, 'view', 5),
  ('be000000-0000-4000-8000-000000000001', pg_temp.today(), 'whatsapp', 2),
  ('be000000-0000-4000-8000-000000000001', pg_temp.today(), 'share', 9),
  -- Peers: views 1 to 4, so the typical (median) is 2.5, rounded to 3
  ('be000000-0000-4000-8000-000000000011', pg_temp.today(), 'view', 1),
  ('be000000-0000-4000-8000-000000000012', pg_temp.today(), 'view', 2),
  ('be000000-0000-4000-8000-000000000013', pg_temp.today(), 'view', 3),
  ('be000000-0000-4000-8000-000000000014', pg_temp.today(), 'view', 4);
insert into public.saved_vendors (user_id, vendor_id, event_slug) values
  ('ae000000-0000-4000-8000-000000000001', 'be000000-0000-4000-8000-000000000001', 'reception');

-- Two inquiries today: family 1 heard back in 90 minutes and booked them;
-- family 2 is still waiting
insert into public.inquiries (id, user_id, vendor_id, event_slugs, event_date, guest_band, location,
  message, preferred_contact, sender_name, sender_phone, channel, status, created_at)
values
  ('de000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001',
   'be000000-0000-4000-8000-000000000001', array['reception', 'jaago'], '2027-06-12', '250_500', ' yuba city ',
   'Menu for 300?', 'call', 'Harjit Kaur', '+15305550101', 'email', 'sent', now() - interval '3 hours'),
  ('de000000-0000-4000-8000-000000000002', 'ae000000-0000-4000-8000-000000000002',
   'be000000-0000-4000-8000-000000000001', array['reception'], '2027-06-19', '100_250', 'Yuba City',
   'Do you do halal?', 'call', 'Simran Gill', '+15305550102', 'email', 'sent', now() - interval '1 hour');
insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, created_at)
select c.id, 'ae000000-0000-4000-8000-00000000000e', 'vendor', 'text', 'Yes!', now() - interval '90 minutes'
from public.conversations c
where c.vendor_id = 'be000000-0000-4000-8000-000000000001'
  and c.family_user_id = 'ae000000-0000-4000-8000-000000000001';
update public.inquiries set reply_answer = 'booked' where id = 'de000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_temp.as_user('ae000000-0000-4000-8000-00000000000e');
create temp table week as
  select public.business_insights('be000000-0000-4000-8000-000000000001', pg_temp.today() - 6, pg_temp.today()) as data;

select is(
  (select jsonb_array_length(data -> 'daily') from week),
  7,
  'One row for every day in the period'
);
select is(
  (select data -> 'daily' -> 6 from week),
  jsonb_build_object('day', pg_temp.today(), 'views', 10, 'contacts', 2, 'saves', 1, 'inquiries', 2),
  'Today''s row: views, contact taps (not shares), saves and inquiries'
);
select is(
  (select data -> 'funnel' from week),
  '{"searches": 2, "views": 15, "saves": 1, "contacts": 2, "inquiries": 2, "booked": 1}'::jsonb,
  'From showing up in search to booked'
);
select is(
  (select data -> 'replies' from week),
  '{"leads": 2, "replied": 1, "rate": 0.5, "medianMinutes": 90}'::jsonb,
  'Replied to 1 of 2, after 90 minutes'
);
select is(
  (select data -> 'asks' -> 'events' -> 0 ->> 'slug' from week) || ' '
    || (select data -> 'asks' -> 'events' -> 0 ->> 'count' from week),
  'reception 2',
  'The most asked-about event first'
);
select is(
  (select data -> 'asks' -> 'places' from week),
  '[{"place": "Yuba City", "count": 2}]'::jsonb,
  'Towns are tidied up before counting'
);
select is(
  (select jsonb_array_length(data -> 'asks' -> 'months') from week),
  1,
  'Wedding months are counted by month'
);
select ok(
  (select data -> 'compare' = 'null'::jsonb from week),
  'No comparison with only 4 vendors like them nearby'
);
reset role;

-- A fifth caterer nearby makes the comparison safe to show
insert into public.vendors (id, slug, status, name, city, location) values
  ('be000000-0000-4000-8000-000000000015', 'ins-peer-5', 'published', 'Peer 5', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_categories (vendor_id, category_slug, position) values
  ('be000000-0000-4000-8000-000000000015', 'kids-entertainment', 1);
insert into public.vendor_activity_daily (vendor_id, day, kind, count) values
  ('be000000-0000-4000-8000-000000000015', pg_temp.today(), 'view', 3);

set local role authenticated;
select pg_temp.as_user('ae000000-0000-4000-8000-00000000000e');
select is(
  (select public.business_insights('be000000-0000-4000-8000-000000000001', pg_temp.today() - 6, pg_temp.today())
     -> 'compare') - 'category'::text,
  '{"peers": 5, "views": {"mine": 15, "typical": 3}, "inquiries": {"mine": 2, "typical": 0}}'::jsonb,
  'With 5 nearby (not the far one or the draft), the typical numbers for their kind show'
);

-- Reels and the checklist ---------------------------------------------------------------

reset role;
insert into public.reels (id, author_id, vendor_id, video_path, duration_s, caption) values
  ('ee000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-00000000000e',
   'be000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-00000000000e/a.mp4', 10, 'Our tandoor');
insert into public.reel_views_daily (reel_id, day, count) values
  ('ee000000-0000-4000-8000-000000000001', pg_temp.today(), 40),
  ('ee000000-0000-4000-8000-000000000001', pg_temp.today() - 3, 2);
insert into public.reel_likes (reel_id, user_id) values
  ('ee000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001');
insert into public.reel_comments (reel_id, user_id, body, hidden) values
  ('ee000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'Looks great', false),
  ('ee000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'spam', true);

set local role authenticated;
select pg_temp.as_user('ae000000-0000-4000-8000-00000000000e');
select results_eq(
  $$ select caption, own, views, likes, comments from public.business_reels('be000000-0000-4000-8000-000000000001') $$,
  $$ values ('Our tandoor', true, 42, 1, 1) $$,
  'Each reel with its views, likes and comments (hidden ones not counted)'
);
select results_eq(
  $$ select key, done from public.business_checklist('be000000-0000-4000-8000-000000000001')
     where key in ('tagline', 'bio', 'contact', 'languages', 'reel', 'menus', 'photos') order by key $$,
  $$ values ('bio', false), ('contact', true), ('languages', true), ('menus', false),
            ('photos', false), ('reel', true), ('tagline', true) $$,
  'The checklist says what''s there and what''s missing, menus included when they cater'
);

-- Strangers -----------------------------------------------------------------------------

select pg_temp.as_user('ae000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.business_insights('be000000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-07') $$,
  '42501', 'not_allowed',
  'Someone else can''t read a vendor''s insights'
);
select throws_ok(
  $$ select * from public.business_reels('be000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'or their reel numbers'
);
select throws_ok(
  $$ select * from public.business_checklist('be000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'or their checklist'
);
reset role;

select * from finish();
rollback;
