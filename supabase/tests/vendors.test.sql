-- Vendors: the data rules the database enforces, and what logged-out and
-- signed-in users can see. Uses its own test vendors (not seed.sql) and rolls
-- everything back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Fixtures, inserted as the table owner (bypasses RLS) ------------------------

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('10000000-0000-4000-8000-000000000001', 'test-published', 'published', 'Test Published',
    'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('10000000-0000-4000-8000-000000000002', 'test-draft', 'draft', 'Test Draft',
    'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('10000000-0000-4000-8000-000000000003', 'test-hidden', 'hidden', 'Test Hidden',
    'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

insert into public.vendor_private (vendor_id, email, street_address) values
  ('10000000-0000-4000-8000-000000000001', 'owner@example.com', '1 Private Lane, Yuba City, CA');

insert into public.vendor_categories (vendor_id, category_slug, position) values
  ('10000000-0000-4000-8000-000000000001', 'dhol', 1),
  ('10000000-0000-4000-8000-000000000002', 'dhol', 1);

insert into public.vendor_events (vendor_id, event_slug) values
  ('10000000-0000-4000-8000-000000000001', 'jaago'),
  ('10000000-0000-4000-8000-000000000002', 'jaago');

-- Data rules ------------------------------------------------------------------

select throws_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location, address_visibility, public_address)
     values ('t-address', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)', 'city_only', '1 Main St') $$,
  '23514', null,
  'A home-based (city only) vendor cannot have a public street address'
);

select lives_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location, address_visibility, public_address)
     values ('t-hall', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)', 'public', '1 Main St') $$,
  'A vendor with a public address (a hall) can list its street address'
);

select throws_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location, price_display, price_unit)
     values ('t-start', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)', 'starting_at', 'event') $$,
  '23514', null,
  'A "starting at" price needs an amount'
);

select throws_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location, price_display, price_from_cents, price_unit)
     values ('t-range1', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)', 'range', 50000, 'event') $$,
  '23514', null,
  'A price range needs both ends'
);

select throws_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location, price_display, price_from_cents, price_to_cents, price_unit)
     values ('t-range2', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)', 'range', 50000, 10000, 'event') $$,
  '23514', null,
  'A price range cannot end below where it starts'
);

select throws_ok(
  $$ insert into public.vendor_contacts (vendor_id, kind, value)
     values ('10000000-0000-4000-8000-000000000001', 'call', '530-555-0100') $$,
  '23514', null,
  'Phone numbers must be stored as +1 and 10 digits'
);

select throws_ok(
  $$ insert into public.vendor_categories (vendor_id, category_slug, position)
     values ('10000000-0000-4000-8000-000000000001', 'dj', 4) $$,
  '23514', null,
  'A vendor can be listed in at most 3 categories'
);

select throws_ok(
  $$ insert into public.vendor_categories (vendor_id, category_slug, position)
     values ('10000000-0000-4000-8000-000000000001', 'dj', 1) $$,
  '23505', null,
  'A vendor has only one primary category'
);

-- Logged out ------------------------------------------------------------------

set local role anon;

select results_eq(
  $$ select slug from public.vendors where slug like 'test-%' order by slug $$,
  array['test-published'],
  'Logged-out users see published vendors only (not drafts or hidden ones)'
);

select is(
  (select count(*)::int from public.vendor_categories
   where vendor_id = '10000000-0000-4000-8000-000000000002'),
  0,
  'Categories of an unpublished vendor are hidden'
);

select is(
  (select count(*)::int from public.vendor_events
   where vendor_id = '10000000-0000-4000-8000-000000000002'),
  0,
  'Events of an unpublished vendor are hidden'
);

select throws_ok(
  $$ select email from public.vendor_private $$,
  '42501', null,
  'Logged-out users cannot read vendor emails or addresses'
);

select throws_ok(
  $$ insert into public.vendors (slug, name, base_city_slug, location)
     values ('t-anon', 'T', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)') $$,
  '42501', null,
  'Logged-out users cannot add vendors'
);

reset role;

-- Signed in -------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  $$ select street_address from public.vendor_private $$,
  '42501', null,
  'Signed-in users cannot read vendor emails or addresses'
);

select throws_ok(
  $$ update public.vendors set name = 'Changed' $$,
  '42501', null,
  'Signed-in users cannot edit vendors'
);

reset role;

-- Defence in depth (vision section 8) ---------------------------------------

-- Even if someone adds a policy to vendor_private by mistake, the API roles
-- have no privileges on it, so it stays closed.
create policy "Added by mistake" on public.vendor_private
  for select to anon, authenticated using (true);

set local role anon;

select throws_ok(
  $$ select email from public.vendor_private $$,
  '42501', null,
  'vendor_private stays closed even with a policy added by mistake'
);

reset role;

select is(
  (select count(*)::int from public.vendor_private
   where vendor_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'The service side (table owner) can still read vendor_private'
);

select * from finish();
rollback;
