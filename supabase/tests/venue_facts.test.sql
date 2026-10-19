-- Hall facts: set_hall_facts() turns a founder's vendor-file facts into
-- venue_policies and the main room, only the founders' import can call it, and
-- families read a hall's facts only when the hall is published.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('c7000000-0000-4000-8000-000000000001', 'facts-hall', 'published', 'Facts Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('c7000000-0000-4000-8000-000000000002', 'facts-draft', 'draft', 'Facts Draft', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

select private.set_hall_facts('c7000000-0000-4000-8000-000000000001',
  '{"seated_capacity": 700, "outside_catering": "approved_list", "alcohol_policy": "none",
    "corkage": 15, "curfew": "01:00", "security_required": true, "parking_spaces": 400}');

select results_eq(
  $$ select outside_catering, alcohol_policy, corkage_cents, music_curfew::text, security_rule, parking_spaces
     from public.venue_policies where vendor_id = 'c7000000-0000-4000-8000-000000000001' $$,
  $$ values ('approved_list'::text, 'dry'::text, 1500, '01:00:00'::text, 'Security guards required'::text, 400) $$,
  'A founder''s facts become policies: corkage in cents, no alcohol as dry, the curfew as a time'
);
select is(
  (select seated from public.venue_rooms where vendor_id = 'c7000000-0000-4000-8000-000000000001' and name = 'Main hall'),
  700,
  'and the capacity becomes the main room''s seats'
);

select private.set_hall_facts('c7000000-0000-4000-8000-000000000001',
  '{"seated_capacity": 650, "corkage": null}');
select results_eq(
  $$ select p.outside_catering, p.corkage_cents, r.seated
     from public.venue_policies p join public.venue_rooms r on r.vendor_id = p.vendor_id
     where p.vendor_id = 'c7000000-0000-4000-8000-000000000001' $$,
  $$ values ('approved_list'::text, null::integer, 650) $$,
  'Importing again: a fact left out keeps its value, null clears it, the room changes in place'
);

select throws_ok(
  $$ select private.set_hall_facts('c7000000-0000-4000-8000-000000000001', '{"alcohol_policy": "maybe"}') $$,
  '23514', null,
  'A policy outside the known answers is refused'
);

select private.set_hall_facts('c7000000-0000-4000-8000-000000000002', '{"ghori_allowed": true, "seated_capacity": 90}');

set local role anon;
select is(
  (select count(*)::int from public.venue_policies where vendor_id in
    ('c7000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000002'))
  + (select count(*)::int from public.venue_rooms where vendor_id in
    ('c7000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000002')),
  2,
  'Families read a published hall''s policies and rooms, never a draft''s'
);
select throws_ok(
  $$ select public.set_hall_facts('c7000000-0000-4000-8000-000000000001', '{"ghori_allowed": false}') $$,
  '42501', null,
  'Nobody but the founders'' import sets hall facts'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ update public.venue_policies set ghori_allowed = false $$,
  '42501', null,
  'and nobody changes them through the API'
);
reset role;

select * from finish();
rollback;
