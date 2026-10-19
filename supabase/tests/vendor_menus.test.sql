-- Vendor menus: shape checks, who can read them, and nobody writes through the API.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('c5000000-0000-4000-8000-000000000001', 'menu-live', 'published', 'Menu Live', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('c5000000-0000-4000-8000-000000000002', 'menu-draft', 'draft', 'Menu Draft', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

select lives_ok(
  $$ insert into public.vendor_menus (vendor_id, name, diet, price_from, price_unit, min_guests, sections) values
     ('c5000000-0000-4000-8000-000000000001', 'Gold', array['veg', 'halal'], 38, 'plate', 200,
      '[{"title": "Mains", "items": [{"name": "Kadhai paneer", "diet": ["veg"]}, {"name": "Biryani", "description": "Hyderabadi style"}]}]'),
     ('c5000000-0000-4000-8000-000000000002', 'Hidden', '{}', null, null, null, '[]') $$,
  'A menu with sections and dishes saves'
);

select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, sections)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', '[{"title": "Mains", "items": [{"price": 5}]}]') $$,
  '23514', null,
  'Every dish needs a name'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, sections)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', '{"title": "Mains"}') $$,
  '23514', null,
  'Sections must be a list'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, diet)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', array['keto']) $$,
  '23514', null,
  'Only known diet tags'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, price_from)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', 40) $$,
  '23514', null,
  'A price needs a unit'
);

set local role anon;
select results_eq(
  $$ select name from public.vendor_menus where vendor_id in
     ('c5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000002') $$,
  array['Gold'],
  'Anyone can read menus of published vendors only'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name) values ('c5000000-0000-4000-8000-000000000001', 'Sneaky') $$,
  '42501', null,
  'Nobody adds menus through the API yet'
);
reset role;

select * from finish();
rollback;
