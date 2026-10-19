-- Vendor self-service: a vendor's people manage their own menus and calendar,
-- and nobody else's.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a8000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'self-owner@example.com'),
  ('a8000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'self-other@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b8000000-0000-4000-8000-000000000001', 'self-hall', 'draft', 'Self Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('b8000000-0000-4000-8000-000000000002', 'self-other', 'published', 'Self Other', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000e');

select lives_ok(
  $$ insert into public.vendor_menus (vendor_id, name, price_from, price_unit, min_guests, sections)
     values ('b8000000-0000-4000-8000-000000000001', 'Gold', 45, 'plate', 200,
       '[{"title": "Mains", "items": [{"name": "Dal makhani"}]}]') $$,
  'The owner adds a menu'
);
update public.vendor_menus set price_from = 48 where name = 'Gold';
select is((select price_from from public.vendor_menus where name = 'Gold'), 48,
  'changes it, and sees it even while the listing is unpublished');
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name) values ('b8000000-0000-4000-8000-000000000002', 'Sneaky') $$,
  '42501', null,
  'but can''t add menus to another vendor'
);

select lives_ok(
  $$ insert into public.vendor_days (vendor_id, day, part, status) values
     ('b8000000-0000-4000-8000-000000000001', '2027-06-12', 'all_day', 'booked'),
     ('b8000000-0000-4000-8000-000000000001', '2027-06-19', 'evening', 'held') $$,
  'The owner marks days booked and held'
);
update public.vendor_days set status = 'booked' where day = '2027-06-19';
delete from public.vendor_days where day = '2027-06-12';
select results_eq(
  $$ select day::text, status from public.vendor_days where vendor_id = 'b8000000-0000-4000-8000-000000000001' $$,
  $$ values ('2027-06-19'::text, 'booked'::text) $$,
  'changes a hold to booked and clears a day'
);
reset role;
select ok(
  (select calendar_updated_at > now() - interval '1 minute' from public.vendors where id = 'b8000000-0000-4000-8000-000000000001'),
  'Any calendar change marks the calendar current'
);
update public.vendors set calendar_updated_at = null where id = 'b8000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000e');
select public.touch_vendor_calendar('b8000000-0000-4000-8000-000000000001');
reset role;
select ok(
  (select calendar_updated_at is not null from public.vendors where id = 'b8000000-0000-4000-8000-000000000001'),
  '"My calendar is up to date" marks it current too'
);

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000d');
select is(
  (select count(*)::int from public.vendor_menus where vendor_id = 'b8000000-0000-4000-8000-000000000001'),
  0,
  'Others can''t see an unpublished vendor''s menus'
);
delete from public.vendor_menus where name = 'Gold';
select throws_ok(
  $$ select public.touch_vendor_calendar('b8000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'or touch their calendar'
);
reset role;
select is((select count(*)::int from public.vendor_menus where name = 'Gold'), 1,
  'or delete their menus');

select * from finish();
rollback;
