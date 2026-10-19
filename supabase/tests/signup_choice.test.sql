-- Choose at sign-up (#222): the choice is saved on the profile, and a wedding
-- business can make its own draft listing, which stays hidden until published.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a2220000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dhol-owner@example.com'),
  ('a2220000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'no-profile@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a2220000-0000-4000-8000-000000000001", "role": "authenticated"}', true);

insert into public.profiles (id, full_name, city, phone, joined_as)
values ('a2220000-0000-4000-8000-000000000001', 'Jas Dhillon', 'Yuba City', '+15305550222', 'business');
select is(
  (select joined_as from public.profiles where id = 'a2220000-0000-4000-8000-000000000001'),
  'business',
  'People save what they picked at sign-up'
);
select throws_ok(
  $$ update public.profiles set joined_as = 'vendor' where id = 'a2220000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'Only planning, looking or business'
);

create temp table made on commit drop as
  select public.start_my_business('  Jas Dhol Beats  ', 'dhol', 'yuba-city') as r;
select is(
  (select r ->> 'slug' from made),
  'jas-dhol-beats',
  'The listing gets a slug from its name'
);
reset role;
select results_eq(
  $$ select status, provenance, base_city_slug, name from public.vendors where id = (select (r ->> 'vendorId')::uuid from made) $$,
  $$ values ('draft'::text, 'self_signup'::text, 'yuba-city'::text, 'Jas Dhol Beats'::text) $$,
  'It starts as a draft in the chosen city'
);
set local role authenticated;
select is(
  (select role from public.vendor_members where vendor_id = (select (r ->> 'vendorId')::uuid from made)),
  'owner',
  'The person who signed up owns it'
);
select is(
  (select count(*)::int from public.my_businesses()),
  1,
  'It shows in My business'
);
select is(
  public.start_my_business('jas dhol beats', 'dhol', 'yuba-city') ->> 'vendorId',
  (select r ->> 'vendorId' from made),
  'Signing up again with the same name returns the same draft'
);
select throws_ok(
  $$ select public.start_my_business('Another', 'not-a-type', 'yuba-city') $$,
  '22023',
  'invalid_category',
  'The vendor type must exist'
);
select public.start_my_business('Second', 'dhol', 'yuba-city');
select public.start_my_business('Third', 'dhol', 'yuba-city');
select throws_ok(
  $$ select public.start_my_business('Fourth', 'dhol', 'yuba-city') $$,
  'P0001',
  'too_many_drafts',
  'At most 3 drafts each'
);

select set_config('request.jwt.claims', '{"sub": "a2220000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.start_my_business('No Profile Co', 'dhol', 'yuba-city') $$,
  '42501',
  'needs_profile',
  'About you comes first'
);

set local role anon;
select is_empty(
  $$ select 1 from public.vendors where slug = 'jas-dhol-beats' $$,
  'A draft is hidden from everyone else until a founder publishes it'
);

select * from finish();
rollback;
