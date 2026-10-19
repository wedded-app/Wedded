-- Vendor menus: shape checks on menus and their dishes, who can read them,
-- and nobody writes them through the API directly.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('c5000000-0000-4000-8000-000000000001', 'menu-live', 'published', 'Menu Live', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('c5000000-0000-4000-8000-000000000002', 'menu-draft', 'draft', 'Menu Draft', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

select lives_ok(
  $$ with menus as (
       insert into public.vendor_menus (id, vendor_id, name, diet_tags, price_from_cents, price_unit, min_guests) values
         ('c5100000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'Gold',
          array['veg', 'halal'], 3800, 'plate', 200),
         ('c5100000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000002', 'Hidden',
          '{}', null, null, null)
       returning id
     )
     insert into public.menu_items (menu_id, section, name, description, diet_tags, sort_order) values
       ('c5100000-0000-4000-8000-000000000001', 'Mains', 'Kadhai paneer', null, array['veg'], 1),
       ('c5100000-0000-4000-8000-000000000001', 'Mains', 'Biryani', 'Hyderabadi style', '{}', 2),
       ('c5100000-0000-4000-8000-000000000002', 'Mains', 'Dal', null, '{}', 1) $$,
  'A menu with dishes under titled sections saves'
);

select throws_ok(
  $$ insert into public.menu_items (menu_id, section, name, sort_order)
     values ('c5100000-0000-4000-8000-000000000001', 'Mains', '  ', 3) $$,
  '23514', null,
  'Every dish needs a name'
);
select throws_ok(
  $$ insert into public.menu_items (menu_id, section, name, sort_order)
     values ('c5100000-0000-4000-8000-000000000001', 'Mains', 'Naan', 1) $$,
  '23505', null,
  'Each dish has its own place in the order'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, diet_tags)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', array['keto']) $$,
  '23514', null,
  'Only known diet tags'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name, price_from_cents)
     values ('c5000000-0000-4000-8000-000000000001', 'Bad', 4000) $$,
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
select results_eq(
  $$ select name from public.menu_items
     where menu_id in ('c5100000-0000-4000-8000-000000000001', 'c5100000-0000-4000-8000-000000000002')
     order by sort_order $$,
  array['Kadhai paneer', 'Biryani'],
  'and only their dishes, in order'
);
select throws_ok(
  $$ insert into public.vendor_menus (vendor_id, name) values ('c5000000-0000-4000-8000-000000000001', 'Sneaky') $$,
  '42501', null,
  'Nobody adds menus through the API directly'
);
reset role;

select * from finish();
rollback;
