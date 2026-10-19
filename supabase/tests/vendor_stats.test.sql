-- Vendor numbers: anonymous activity counts, the public "saved by" and
-- "replied to" lines with their minimum of 5, the founders' scorecard, and the
-- vendor sign-up limits.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('60000000-0000-4000-8000-000000000001', 'stats-live', 'published', 'Stats Live', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)'),
  ('60000000-0000-4000-8000-000000000002', 'stats-draft', 'draft', 'Stats Draft', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)');

insert into auth.users (id, instance_id, aud, role, email)
select ('70000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'stats' || n || '@example.com'
from generate_series(1, 6) as n;

-- Activity ---------------------------------------------------------------------------

set local role anon;
select public.track_vendor_activity('60000000-0000-4000-8000-000000000001', 'view');
select public.track_vendor_activity('60000000-0000-4000-8000-000000000001', 'view');
select public.track_vendor_activity('60000000-0000-4000-8000-000000000001', 'call');
select public.track_vendor_activity('60000000-0000-4000-8000-000000000002', 'view');
select throws_ok(
  $$ select public.track_vendor_activity('60000000-0000-4000-8000-000000000001', 'like') $$,
  '22023', 'invalid_kind',
  'Only known kinds of activity are counted'
);
select throws_ok(
  $$ select * from public.vendor_activity_daily $$,
  '42501', null,
  'Nobody can read the counts through the API'
);
reset role;

select is(
  (select count from public.vendor_activity_daily
   where vendor_id = '60000000-0000-4000-8000-000000000001' and kind = 'view'),
  2,
  'Logged-out views are counted, one row per vendor, day and kind'
);
select is(
  (select count(*)::int from public.vendor_activity_daily
   where vendor_id = '60000000-0000-4000-8000-000000000002'),
  0,
  'Unpublished vendors are not counted'
);

-- Public stats -------------------------------------------------------------------------

insert into public.saved_vendors (user_id, vendor_id)
select ('70000000-0000-4000-8000-00000000000' || n)::uuid, '60000000-0000-4000-8000-000000000001'
from generate_series(1, 4) as n;

set local role anon;
select is(
  (select saved_by from public.vendor_public_stats('60000000-0000-4000-8000-000000000001')),
  null,
  'Fewer than 5 saves shows nothing'
);
reset role;

-- The fifth family saves them for two of their wedding's events
insert into public.weddings (id, created_by)
values ('7a000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000005');
insert into public.wedding_events (wedding_id, event_slug) values
  ('7a000000-0000-4000-8000-000000000005', 'reception'),
  ('7a000000-0000-4000-8000-000000000005', 'jaago');
insert into public.saved_vendors (user_id, vendor_id, wedding_id, wedding_event_id)
select '70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', we.wedding_id, we.id
from public.wedding_events we
where we.wedding_id = '7a000000-0000-4000-8000-000000000005';

set local role anon;
select is(
  (select saved_by from public.vendor_public_stats('60000000-0000-4000-8000-000000000001')),
  5,
  'Five families saving shows "saved by 5", counting each family once'
);
reset role;

insert into public.inquiries (vendor_id, guest_band, location, message, preferred_contact,
  channel, status, reply_answer)
select '60000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price?', 'call', 'email', 'sent', a
from unnest(array['booked', 'deciding', 'deciding', 'no_reply']) as a;

set local role anon;
select is(
  (select replied from public.vendor_public_stats('60000000-0000-4000-8000-000000000001')),
  null,
  'Fewer than 5 follow-up answers shows no reply line'
);
reset role;

insert into public.inquiries (vendor_id, guest_band, location, message, preferred_contact,
  channel, status, reply_answer)
values
  ('60000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price?', 'call', 'email', 'sent', 'booked'),
  ('60000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price?', 'call', 'email', 'sent', null);

set local role anon;
select results_eq(
  $$ select replied, answered from public.vendor_public_stats('60000000-0000-4000-8000-000000000001') $$,
  $$ values (4, 5) $$,
  'Replied to 4 of 5 families who answered; an unanswered follow-up doesn''t count'
);
select is(
  (select count(*)::int from public.vendor_public_stats('60000000-0000-4000-8000-000000000002')),
  0,
  'Unpublished vendors have no public stats'
);
select throws_ok(
  $$ select * from public.vendor_scorecard('60000000-0000-4000-8000-000000000001', current_date - 30, current_date) $$,
  '42501', null,
  'The scorecard is for the founders only'
);
reset role;

set local role service_role;
select results_eq(
  $$ select views, calls, saves, inquiries, replied, answered
     from public.vendor_scorecard('60000000-0000-4000-8000-000000000001',
       (now() at time zone 'America/Los_Angeles')::date - 30, (now() at time zone 'America/Los_Angeles')::date) $$,
  $$ values (2, 1, 6, 6, 4, 5) $$,
  'The scorecard adds up views, calls, saves, inquiries and follow-up answers'
);
reset role;

-- Vendor sign-up limits --------------------------------------------------------------------

set local role anon;
insert into public.vendor_leads (business_name, contact_name, city, phone)
select 'Spam Hall ' || n, 'Spammer', 'Yuba City', '+15305550999' from generate_series(1, 3) as n;
select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone)
     values ('Spam Hall 4', 'Spammer', 'Yuba City', '+15305550999') $$,
  'P0001', 'lead_limit',
  'One phone number can send at most 3 sign-ups a day'
);
select lives_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone)
     values ('Real Hall', 'Owner', 'Yuba City', '+15305550998') $$,
  'Someone else can still sign up'
);
reset role;

select * from finish();
rollback;
