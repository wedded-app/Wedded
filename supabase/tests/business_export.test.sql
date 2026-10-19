-- Export everything: a vendor's people get all of their data in one call, and
-- nobody else gets any of it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('ad000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'export-owner@example.com'),
  ('ad000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'export-stranger@example.com'),
  ('ad000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'export-family@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('bd000000-0000-4000-8000-000000000001', 'export-hall', 'published', 'Export Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('bd000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-00000000000e');

insert into public.inquiries (id, user_id, vendor_id, event_date, guest_band, city_slug,
  message, preferred_contact, sender_name, sender_phone, sender_email, channel, status)
values
  ('ad100000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'bd000000-0000-4000-8000-000000000001',
   '2027-06-12', '250_500', 'yuba-city', 'Is June 12 open?', 'call',
   'Harjit Kaur', '+15305550101', 'harjit@example.com', 'email', 'sent');
insert into public.inquiry_events (inquiry_id, event_slug, position) values
  ('ad100000-0000-4000-8000-000000000001', 'reception', 1), ('ad100000-0000-4000-8000-000000000001', 'jaago', 2);
insert into public.vendor_activity_daily (vendor_id, day, kind, count) values
  ('bd000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date, 'view', 7);
insert into public.vendor_days (vendor_id, day, part, status) values
  ('bd000000-0000-4000-8000-000000000001', '2027-06-12', 'all_day', 'booked'),
  ('bd000000-0000-4000-8000-000000000001', (now() at time zone 'America/Los_Angeles')::date - 400, 'all_day', 'booked');
insert into public.vendor_menus (id, vendor_id, name, price_from_cents, price_unit) values
  ('bd100000-0000-4000-8000-000000000001', 'bd000000-0000-4000-8000-000000000001', 'Gold', 4500, 'plate');
insert into public.menu_items (menu_id, section, name, sort_order) values
  ('bd100000-0000-4000-8000-000000000001', 'Mains', 'Dal makhani', 1);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('ad000000-0000-4000-8000-00000000000e');
create temp table export as
  select public.business_export('bd000000-0000-4000-8000-000000000001') as data;

select is(
  (select data -> 'vendor' ->> 'name' from export),
  'Export Hall',
  'The export names the business'
);
select is(
  (select data -> 'leads' -> 0 ->> 'familyName' from export),
  'Harjit K.',
  'Leads carry the short family name'
);
select is(
  (select data -> 'leads' -> 0 -> 'events' from export),
  (select jsonb_build_array(
     (select name ->> 'en' from public.events where slug = 'reception'),
     (select name ->> 'en' from public.events where slug = 'jaago'))),
  'Event names come in English, in the order the family picked'
);
select ok(
  (select data -> 'leads' -> 0 -> 'email' = 'null'::jsonb from export),
  'No email when the family asked for a call'
);
select is(
  (select jsonb_array_length(data -> 'months') from export),
  12,
  'Twelve months of numbers'
);
select is(
  (select (data -> 'months' -> 0 ->> 'views')::int from export),
  7,
  'This month comes first, with its views'
);
select is(
  (select jsonb_array_length(data -> 'days') || ' ' || jsonb_array_length(data -> 'menus') from export),
  '1 1',
  'Booked days from the last year on, and the menus'
);

select is(
  (select (data -> 'menus' -> 0) - 'cuisine' - 'description' - 'minGuests' - 'diet' from export),
  '{"name": "Gold", "priceFrom": 45, "priceUnit": "plate", "sections": [{"title": "Mains", "items": [{"name": "Dal makhani"}]}]}'::jsonb,
  'A menu exports in whole dollars, with its sections rebuilt from its dishes'
);

select pg_temp.as_user('ad000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.business_export('bd000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'Someone else can''t export a vendor''s data'
);
reset role;

select * from finish();
rollback;
