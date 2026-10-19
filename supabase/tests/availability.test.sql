-- Availability: a vendor's status on a day, the "free on our date" search
-- filter, and who can read calendars.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into public.vendors (id, slug, status, name, base_city_slug, location, calendar_updated_at) values
  ('80000000-0000-4000-8000-000000000001', 'cal-hall', 'published', 'Cal Hall', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)', now()),
  ('80000000-0000-4000-8000-000000000002', 'cal-stale', 'published', 'Cal Stale', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)', now() - interval '90 days'),
  ('80000000-0000-4000-8000-000000000003', 'cal-draft', 'draft', 'Cal Draft', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)', now());

insert into public.vendor_categories (vendor_id, category_slug, position)
select id, 'kids-entertainment', 1 from public.vendors where slug like 'cal-%';

insert into public.vendor_days (vendor_id, day, part, status) values
  ('80000000-0000-4000-8000-000000000001', '2027-06-12', 'all_day', 'booked'),
  ('80000000-0000-4000-8000-000000000001', '2027-06-13', 'all_day', 'held'),
  ('80000000-0000-4000-8000-000000000001', '2027-06-19', 'morning', 'booked'),
  ('80000000-0000-4000-8000-000000000001', '2027-06-26', 'morning', 'booked'),
  ('80000000-0000-4000-8000-000000000001', '2027-06-26', 'evening', 'booked'),
  ('80000000-0000-4000-8000-000000000003', '2027-06-12', 'all_day', 'booked');

set local role anon;

select is(public.vendor_date_status('80000000-0000-4000-8000-000000000001', '2027-06-12'), 'booked',
  'A day booked all day is booked');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000001', '2027-06-13'), 'held',
  'A day on hold is held');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000001', '2027-06-19'), 'partly',
  'Morning booked, evening free: partly');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000001', '2027-06-26'), 'booked',
  'Morning and evening both booked: booked');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000001', '2027-07-03'), 'open',
  'An unmarked day on a recent calendar is open');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000002', '2027-07-03'), 'unknown',
  'A calendar not updated in 60 days never promises a date');
select is(public.vendor_date_status('80000000-0000-4000-8000-000000000003', '2027-06-12'), 'unknown',
  'Unpublished vendors say nothing');

select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null,
       available_on => '2027-06-12') $$,
  array['cal-stale'],
  '"Free on our date" leaves out vendors booked all day'
);
select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null,
       available_on => '2027-06-13') $$,
  array['cal-hall', 'cal-stale'],
  'and keeps vendors who are only holding the date'
);
select is(
  (select count(*)::int from public.vendor_days
   where vendor_id = '80000000-0000-4000-8000-000000000003'),
  0,
  'Calendars of unpublished vendors are hidden'
);

select * from finish();
rollback;
