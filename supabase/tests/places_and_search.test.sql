-- Places (cities, area codes, ZIP codes) and search_vendors. The search tests
-- use their own vendors in a category no sample vendor uses (kids
-- entertainment), so they don't depend on seed.sql.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- Places ------------------------------------------------------------------------------

select is((select count(*)::int from public.cities), 101, 'All 101 launch cities are present');

select set_eq(
  $$ select code from public.area_codes $$,
  array['510', '408', '916', '209', '530', '925', '650', '559', '707'],
  'The nine launch area codes are chips'
);

select ok(
  (select count(*) > 1700 from public.zip_codes)
  and exists (select 1 from public.zip_codes where zip = '95993'),
  'California ZIP codes are present, including Yuba City''s 95993'
);

select ok(
  (select extensions.st_distance(y.location, s.location) / 1609.344 between 37 and 43
   from public.cities y, public.cities s
   where y.slug = 'yuba-city' and s.slug = 'sacramento'),
  'City points are real: Yuba City to Sacramento is about 40 miles'
);

select is(
  (select count(*)::int from public.cities where region_slug is null), 0,
  'Every city belongs to a region'
);

select is(
  (select region_slug from public.cities where slug = 'stockton') || ' ' ||
  (select region_slug from public.cities where slug = 'modesto') || ' ' ||
  (select region_slug from public.cities where slug = 'davis'),
  '209-north 209-south sacramento',
  'Cities sit in the right market: Stockton 209 North, Modesto 209 South, Davis Sacramento'
);

select ok(
  (select city_slug = 'yuba-city' from public.zip_codes where zip = '95993')
  and (select city_slug is null from public.zip_codes where zip = '90210'),
  'A ZIP reads as its nearest listed city (95993 is Yuba City); one far from every listed city has none'
);

-- Test vendors (as the table owner) ---------------------------------------------------

insert into public.vendors (id, slug, status, name, base_city_slug, location, service_radius_miles, will_travel) values
  ('30000000-0000-4000-8000-000000000001', 'zz-near', 'published', 'Zz Near', 'yuba-city',
    (select location from public.cities where slug = 'yuba-city'), 10, false),
  ('30000000-0000-4000-8000-000000000002', 'zz-wide', 'published', 'Zz Wide', 'sacramento',
    (select location from public.cities where slug = 'sacramento'), 50, false),
  ('30000000-0000-4000-8000-000000000003', 'zz-traveler', 'published', 'Zz Traveler', 'fresno',
    (select location from public.cities where slug = 'fresno'), 25, true),
  ('30000000-0000-4000-8000-000000000004', 'zz-draft', 'draft', 'Zz Draft', 'yuba-city',
    (select location from public.cities where slug = 'yuba-city'), 10, false);

insert into public.vendor_categories (vendor_id, category_slug, position)
select id, 'kids-entertainment', 1 from public.vendors where slug like 'zz-%';

insert into public.vendor_events (vendor_id, event_slug) values
  ('30000000-0000-4000-8000-000000000001', 'jaago'),
  ('30000000-0000-4000-8000-000000000002', 'reception'),
  ('30000000-0000-4000-8000-000000000003', 'reception');

-- Search, as a logged-out user ---------------------------------------------------------

set local role anon;

select results_eq(
  $$ select name from public.search_vendors(
       lat => 39.129842, lng => -121.641549, max_miles => 10, category_slug => 'kids-entertainment') $$,
  array['Zz Near', 'Zz Wide'],
  'Nearest first; a vendor whose service radius covers you shows up beyond your radius; drafts never show'
);

select results_eq(
  $$ select within_search_radius from public.search_vendors(
       lat => 39.129842, lng => -121.641549, max_miles => 10, category_slug => 'kids-entertainment') $$,
  array[true, false],
  'within_search_radius says who is inside your radius and who comes to you'
);

select results_eq(
  $$ select name from public.search_vendors(
       lat => 39.129842, lng => -121.641549, max_miles => 10, category_slug => 'kids-entertainment',
       include_travelers => true) $$,
  array['Zz Near', 'Zz Wide', 'Zz Traveler'],
  'Vendors who will travel appear only when asked for'
);

select is(
  (select count(*)::int from public.search_vendors(
     lat => 39.129842, lng => -121.641549, max_miles => null, category_slug => 'kids-entertainment')),
  3,
  'Anywhere (no max distance) finds every published vendor'
);

select ok(
  (select bool_and(distance_miles is null) and count(*) = 3
   from public.search_vendors(category_slug => 'kids-entertainment')),
  'Without a location, results still come back, with no distance'
);

select results_eq(
  $$ select name from public.search_vendors(
       lat => 39.129842, lng => -121.641549, max_miles => null,
       category_slug => 'kids-entertainment', event_slug => 'reception') $$,
  array['Zz Wide', 'Zz Traveler'],
  'The event filter keeps only vendors who serve that event'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'face paint') where name like 'Zz%'),
  3,
  'Text search matches category synonyms (kids entertainment: face painting)'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'zz near')),
  1,
  'Text search matches vendor names, ignoring case'
);

select is(
  (select count(*)::int from public.search_vendors(category_slug => 'kids-entertainment', result_limit => 1)),
  1,
  'result_limit pages the results'
);

select ok(
  (select distance_miles between 37 and 43 from public.search_vendors(
     lat => 39.129842, lng => -121.641549, max_miles => 10, category_slug => 'kids-entertainment')
   where name = 'Zz Wide'),
  'Distances are in miles'
);

select ok(
  (select abs(latitude - 38.5816) < 0.1 and abs(longitude - (-121.4944)) < 0.1
   from public.search_vendors(category_slug => 'kids-entertainment') where name = 'Zz Wide'),
  'Each result carries its map point for the app'
);

select throws_ok(
  $$ insert into public.cities (slug, name, area_code, latitude, longitude)
     values ('test', 'Test', '530', 39, -121) $$,
  '42501', null,
  'Logged-out users cannot change places'
);

reset role;

select throws_ok(
  $$ insert into public.zip_codes (zip, latitude, longitude) values ('10001', 40.75, -73.99) $$,
  '23514', null,
  'Only California points are accepted'
);

select * from finish();
rollback;
