-- Sign-up asks only the name: a profile can start with no city or phone, the
-- database still stamps 18+, and a city or phone added later still has to be
-- a real one.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('c0000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'person-c@example.com');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "c0000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.profiles (id, full_name)
     values ('c0000000-0000-4000-8000-00000000000c', 'Simran Kaur') $$,
  'A new person can make their profile with only their name'
);

select ok(
  (select city is null and phone is null
     and adult_confirmed_at > now() - interval '1 minute'
   from public.profiles where id = 'c0000000-0000-4000-8000-00000000000c'),
  'It has no city or phone yet, and the database still stamps the 18+ confirmation'
);

select throws_ok(
  $$ update public.profiles set city = '   '
     where id = 'c0000000-0000-4000-8000-00000000000c' $$,
  '23514', null,
  'A city given later still can''t be blank'
);

select throws_ok(
  $$ update public.profiles set phone = '5305550111'
     where id = 'c0000000-0000-4000-8000-00000000000c' $$,
  '23514', null,
  'A phone given later still has to be in international format'
);

select lives_ok(
  $$ update public.profiles set city = 'Yuba City', phone = '+15305550111'
     where id = 'c0000000-0000-4000-8000-00000000000c' $$,
  'They can add their city and phone when they first message a vendor'
);

select is(
  (select city || ' ' || phone from public.profiles
   where id = 'c0000000-0000-4000-8000-00000000000c'),
  'Yuba City +15305550111',
  'Both are saved'
);

select * from finish();
rollback;
