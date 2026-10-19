-- search_vendors filters: guest capacity, price ceiling, language and sort.
-- Uses its own "Ff" vendors in kids entertainment (no sample vendor there).

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.vendors (id, slug, status, name, base_city_slug, location,
  price_display, price_from_cents, price_unit, founding_number, details) values
  ('50000000-0000-4000-8000-000000000001', 'ff-big-hall', 'published', 'Ff Big Hall', 'yuba-city',
    (select location from public.cities where slug = 'yuba-city'),
    'starting_at', 6000, 'plate', null, '{"seated_capacity": 700}'),
  ('50000000-0000-4000-8000-000000000002', 'ff-small-hall', 'published', 'Ff Small Hall', 'yuba-city',
    (select location from public.cities where slug = 'yuba-city'),
    'starting_at', 3000, 'plate', 7, '{"seated_capacity": 150}'),
  ('50000000-0000-4000-8000-000000000003', 'ff-dj', 'published', 'Ff DJ', 'yuba-city',
    (select location from public.cities where slug = 'yuba-city'),
    'contact', null, null, null, '{}');
insert into public.vendor_languages (vendor_id, language_code) values
  ('50000000-0000-4000-8000-000000000001', 'en'), ('50000000-0000-4000-8000-000000000001', 'pa'),
  ('50000000-0000-4000-8000-000000000002', 'en'),
  ('50000000-0000-4000-8000-000000000003', 'en'), ('50000000-0000-4000-8000-000000000003', 'hi');

insert into public.vendor_categories (vendor_id, category_slug, position)
select id, 'kids-entertainment', 1 from public.vendors where slug like 'ff-%';

set local role anon;

select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, min_guests => 400) $$,
  array['ff-big-hall', 'ff-dj'],
  'Guest capacity drops venues that are too small, and keeps vendors without a capacity'
);

select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, max_price_cents => 4000) $$,
  array['ff-small-hall', 'ff-dj'],
  'A price ceiling drops pricier vendors and keeps "contact for price"'
);

select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, language => 'hi') $$,
  array['ff-dj'],
  'Language keeps vendors who speak it'
);

select results_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, sort => 'price_low') $$,
  array['ff-small-hall', 'ff-big-hall', 'ff-dj'],
  'Sort by price: cheapest shown price first, no price last'
);

select is(
  (select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, sort => 'founding') limit 1),
  'ff-small-hall',
  'Sort by founding: founding vendors first'
);

select is(
  (select count(*)::int from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null, sort => 'nonsense')),
  3,
  'An unknown sort falls back to distance and hides nothing'
);

select is(
  (select count(*)::int from public.search_vendors(39.1404, -121.6169, 25, 'kids-entertainment', null, null, false, 50, 0)),
  3,
  'The original nine arguments still work'
);

select set_eq(
  $$ select slug from public.search_vendors(category_slug => 'kids-entertainment', max_miles => null,
       min_guests => 400, max_price_cents => 4000, language => 'en') $$,
  array['ff-dj'],
  'Filters combine: no hall seats 400 for under $40, so only the DJ is left'
);

select * from finish();
rollback;
