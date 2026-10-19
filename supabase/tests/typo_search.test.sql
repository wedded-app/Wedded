-- search_vendors typo tolerance: close spellings match only when nothing
-- matches exactly, every typed word must match, and % and _ are literal.
-- Uses its own "Qq" vendors, so it doesn't depend on seed.sql.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('40000000-0000-4000-8000-000000000001', 'qq-quorvex-sweets', 'published', 'Qq Quorvex Sweets',
    'yuba-city', (select location from public.cities where slug = 'yuba-city')),
  ('40000000-0000-4000-8000-000000000002', 'qq-pellam-decor', 'published', 'Qq Pellam Decor',
    'yuba-city', (select location from public.cities where slug = 'yuba-city')),
  ('40000000-0000-4000-8000-000000000003', 'qq-pellan-decor', 'published', 'Qq Pellan Decor',
    'yuba-city', (select location from public.cities where slug = 'yuba-city'));

insert into public.vendor_categories (vendor_id, category_slug, position)
select id, 'kids-entertainment', 1 from public.vendors where slug like 'qq-%';

set local role anon;

select results_eq(
  $$ select name from public.search_vendors(query => 'quorvx') $$,
  array['Qq Quorvex Sweets'],
  'A misspelled vendor name still finds the vendor'
);

select results_eq(
  $$ select name from public.search_vendors(query => 'pellam') $$,
  array['Qq Pellam Decor'],
  'An exact match hides close spellings (Pellan is one letter off)'
);

select set_eq(
  $$ select name from public.search_vendors(query => 'pellax') $$,
  array['Qq Pellam Decor', 'Qq Pellan Decor'],
  'With no exact match, every close spelling shows'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'face paintng') where name like 'Qq%'),
  3,
  'A misspelled category alias matches (kids entertainment: face painting)'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'pex')),
  0,
  'Words under 4 letters must match exactly'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'quorvex zqzqzq')),
  0,
  'Every typed word has to match'
);

select is(
  (select count(*)::int from public.search_vendors(query => '%')),
  0,
  'A % in the query is matched literally, not as "anything"'
);

select is(
  (select count(*)::int from public.search_vendors(query => 'q_')),
  0,
  'An _ in the query is matched literally'
);

reset role;
set local role service_role;

select is(
  (select count(*)::int from public.search_vendors(query => 'quorvx')),
  1,
  'Server tools (the service role) can search too'
);

select * from finish();
rollback;
