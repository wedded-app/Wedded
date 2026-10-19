-- My business: a vendor's people see their own numbers and leads, and nobody
-- else's; reel views are counted anonymously.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, instance_id, aud, role, email) values
  ('ac000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biz-owner@example.com'),
  ('ac000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biz-stranger@example.com'),
  ('ac000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biz-family1@example.com'),
  ('ac000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'biz-family2@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('bc000000-0000-4000-8000-000000000001', 'biz-hall', 'published', 'Biz Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('bc000000-0000-4000-8000-000000000002', 'biz-draft', 'draft', 'Biz Draft', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('bc000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-00000000000e'),
  ('bc000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Activity this week: 3 views, a call and a WhatsApp; and a view last year
insert into public.vendor_activity_daily (vendor_id, day, kind, count) values
  ('bc000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date, 'view', 3),
  ('bc000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date, 'call', 1),
  ('bc000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date, 'whatsapp', 1),
  ('bc000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date - 365, 'view', 9);
insert into public.saved_vendors (user_id, vendor_id) values
  ('ac000000-0000-4000-8000-000000000001', 'bc000000-0000-4000-8000-000000000001');

-- Two inquiries: family 1 asked yesterday and the vendor replied; family 2
-- asked for a tour today and hasn't heard back.
insert into public.inquiries (id, user_id, vendor_id, event_slugs, event_date, guest_band, location,
  message, preferred_contact, sender_name, sender_phone, sender_email, channel, status, created_at, details)
values
  ('dc000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001',
   'bc000000-0000-4000-8000-000000000001', array['reception'], '2027-06-12', '100_250', 'Yuba City',
   'Is June 12 open?', 'call', 'Harjit Kaur', '+15305550101', 'harjit@example.com', 'email', 'sent',
   now() - interval '1 day', '{}'),
  ('dc000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000002',
   'bc000000-0000-4000-8000-000000000001', array['anand-karaj'], null, 'not_sure', 'Marysville',
   'Can we visit?', 'email', 'Simran Gill', '+15305550102', 'simran@example.com', 'email', 'sent',
   now(), '{"tour": true}');

-- The vendor's reply to family 1, straight into the thread
insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body)
select c.id, 'ac000000-0000-4000-8000-00000000000e', 'vendor', 'text', 'Yes, it is open!'
from public.conversations c
where c.vendor_id = 'bc000000-0000-4000-8000-000000000001'
  and c.family_user_id = 'ac000000-0000-4000-8000-000000000001';

-- Reels: the vendor's own, one tagging them, and one they declined
insert into public.reels (id, author_id, vendor_id, video_path, duration_s) values
  ('ec000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-00000000000e',
   'bc000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-00000000000e/a.mp4', 10),
  ('ec000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000001',
   null, 'ac000000-0000-4000-8000-000000000001/b.mp4', 10),
  ('ec000000-0000-4000-8000-000000000003', 'ac000000-0000-4000-8000-000000000002',
   null, 'ac000000-0000-4000-8000-000000000002/c.mp4', 10);
insert into public.reel_vendor_tags (reel_id, vendor_id, status) values
  ('ec000000-0000-4000-8000-000000000002', 'bc000000-0000-4000-8000-000000000001', 'approved'),
  ('ec000000-0000-4000-8000-000000000003', 'bc000000-0000-4000-8000-000000000001', 'declined');

-- Reel views ----------------------------------------------------------------------------

set local role anon;
select lives_ok(
  $$ select public.track_reel_view('ec000000-0000-4000-8000-000000000001');
     select public.track_reel_view('ec000000-0000-4000-8000-000000000001');
     select public.track_reel_view('ec000000-0000-4000-8000-000000000002');
     select public.track_reel_view('ec000000-0000-4000-8000-000000000003') $$,
  'Anyone can count a reel view, signed out too'
);
select throws_ok(
  $$ select * from public.reel_views_daily $$,
  '42501', null,
  'Nobody reads the view counts directly'
);
reset role;

update public.reels set status = 'hidden' where id = 'ec000000-0000-4000-8000-000000000002';
set local role anon;
select public.track_reel_view('ec000000-0000-4000-8000-000000000002');
reset role;
select is(
  (select count from public.reel_views_daily where reel_id = 'ec000000-0000-4000-8000-000000000002'),
  1,
  'Hidden reels stop counting'
);

-- My businesses -------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('ac000000-0000-4000-8000-00000000000e');
select results_eq(
  $$ select slug, status from public.my_businesses() $$,
  $$ values ('biz-draft', 'draft'), ('biz-hall', 'published') $$,
  'A vendor sees the businesses they run, drafts included'
);

-- Stats ---------------------------------------------------------------------------------

select results_eq(
  $$ select views, calls, whatsapps, contacts, saves, inquiries, reel_views
     from public.business_stats('bc000000-0000-4000-8000-000000000001',
       (now() at time zone 'America/Los_Angeles')::date - 6,
       (now() at time zone 'America/Los_Angeles')::date) $$,
  $$ values (3, 1, 1, 2, 1, 2, 3) $$,
  'This week: views, contact taps, saves, inquiries, and views of their own and tagged reels (not declined)'
);
select results_eq(
  $$ select views, inquiries
     from public.business_stats('bc000000-0000-4000-8000-000000000001',
       (now() at time zone 'America/Los_Angeles')::date - 400,
       (now() at time zone 'America/Los_Angeles')::date - 300) $$,
  $$ values (9, 0) $$,
  'An older window counts only its own days'
);
select throws_ok(
  $$ select * from public.business_stats('bc000000-0000-4000-8000-000000000001', '2026-01-01', '2027-06-01') $$,
  '22023', 'invalid_range',
  'Windows longer than 400 days are refused'
);

-- Leads ---------------------------------------------------------------------------------

select results_eq(
  $$ select family_name, is_tour, replied, email, conversation_id is not null
     from public.business_leads('bc000000-0000-4000-8000-000000000001') $$,
  $$ values ('Simran G.', true, false, 'simran@example.com', true),
            ('Harjit K.', false, true, null::text, true) $$,
  'Leads come newest first with the short name, tour, reply state, and email only when asked for'
);
select is(
  (select phone from public.business_leads('bc000000-0000-4000-8000-000000000001')
   where family_name = 'Harjit K.'),
  '+15305550101',
  'The phone the family sent with the inquiry shows'
);
select is(
  (select count(*)::int from public.business_leads('bc000000-0000-4000-8000-000000000001', now() - interval '1 hour')),
  1,
  'Paging: only leads before the given time'
);

-- Strangers -----------------------------------------------------------------------------

select pg_temp.as_user('ac000000-0000-4000-8000-00000000000d');
select is(
  (select count(*)::int from public.my_businesses()),
  0,
  'Someone who runs no business sees none'
);
select throws_ok(
  $$ select * from public.business_stats('bc000000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-07') $$,
  '42501', 'not_allowed',
  'Someone else can''t read a vendor''s numbers'
);
select throws_ok(
  $$ select * from public.business_leads('bc000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'Someone else can''t read a vendor''s leads'
);
reset role;

select * from finish();
rollback;
