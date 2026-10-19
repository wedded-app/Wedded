-- Push alerts: phones register their tokens, each new message is claimed once
-- with the other side's phones, and saving a message never depends on it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1100000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-family@example.com'),
  ('a1100000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-owner@example.com'),
  ('a1100000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-staff@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b1100000-0000-4000-8000-000000000001', 'push-hall', 'published', 'Push Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id, role) values
  ('b1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-00000000000e', 'owner'),
  ('b1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-00000000000f', 'staff');
insert into public.profiles (id, full_name, city, phone) values
  ('a1100000-0000-4000-8000-000000000001', 'Harjit Kaur', 'Yuba City', '+15305550101');
insert into public.conversations (id, vendor_id, family_user_id, family_name) values
  ('c1100000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000001',
   'a1100000-0000-4000-8000-000000000001', 'Harjit K.');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Tokens --------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a1100000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[family-phone-1]', 'ios') $$,
  'A family registers their phone'
);
select throws_ok(
  $$ select public.register_push_token('not a token', 'ios') $$,
  '22023', 'invalid_token',
  'Only Expo push tokens'
);
select throws_ok(
  $$ insert into public.devices (push_token, user_id, platform)
     values ('ExponentPushToken[sneaky-insert]', 'a1100000-0000-4000-8000-00000000000e', 'ios') $$,
  '42501', null,
  'Nobody writes tokens directly'
);

select pg_temp.as_user('a1100000-0000-4000-8000-00000000000e');
select public.register_push_token('ExponentPushToken[owner-phone-1]', 'ios');
select is(
  (select count(*)::int from public.devices),
  1,
  'People see only their own tokens'
);

select pg_temp.as_user('a1100000-0000-4000-8000-00000000000f');
select public.register_push_token('ExponentPushToken[staff-phone-1]', 'android');
-- The staff member signs in on the owner's old phone: it moves to them
select public.register_push_token('ExponentPushToken[owner-phone-1]', 'ios');
reset role;
select is(
  (select user_id from public.devices where push_token = 'ExponentPushToken[owner-phone-1]'),
  'a1100000-0000-4000-8000-00000000000f'::uuid,
  'A phone that changes hands moves to the new person'
);

set local role authenticated;
select pg_temp.as_user('a1100000-0000-4000-8000-00000000000e');
select public.register_push_token('ExponentPushToken[owner-phone-2]', 'ios');
select public.unregister_push_token('ExponentPushToken[staff-phone-1]');
reset role;
select ok(
  exists (select 1 from public.devices where push_token = 'ExponentPushToken[staff-phone-1]'),
  'Nobody can forget someone else''s phone'
);

set local role authenticated;
select pg_temp.as_user('a1100000-0000-4000-8000-000000000001');
select public.register_push_token('ExponentPushToken[family-phone-' || n || ']', 'ios')
from generate_series(2, 11) as n;
reset role;
select is(
  (select count(*)::int from public.devices where user_id = 'a1100000-0000-4000-8000-000000000001'),
  10,
  'Up to 10 phones each; the oldest goes'
);
-- Put family-phone-1 back as the family's newest, for the claims below
set local role authenticated;
select pg_temp.as_user('a1100000-0000-4000-8000-000000000001');
select public.register_push_token('ExponentPushToken[family-phone-1]', 'ios');
reset role;

-- Messages ------------------------------------------------------------------------------

-- An old message from before alerts, never pushed
insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, created_at)
values ('c1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001', 'family', 'text',
  'Old', now() - interval '11 minutes');

set local role authenticated;
select pg_temp.as_user('a1100000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.send_message('c1100000-0000-4000-8000-000000000001', 'text', 'Is June 12 open?');
     select public.send_message('c1100000-0000-4000-8000-000000000001', 'phone') $$,
  'Messages save without Vault set up (the alert call just skips)'
);
select pg_temp.as_user('a1100000-0000-4000-8000-00000000000e');
select public.send_message('c1100000-0000-4000-8000-000000000001', 'text', 'Yes, it is!');
select throws_ok(
  $$ select * from public.claim_push_messages() $$,
  '42501', null,
  'Only the server claims messages to push'
);
reset role;

set local role service_role;
create temp table claim1 as select * from public.claim_push_messages();
reset role;

select is(
  (select count(*)::int from claim1),
  3,
  'The three new messages are claimed; the 11-minute-old one is not'
);
select is(
  (select array(select unnest(tokens) order by 1) from claim1 where body = 'Is June 12 open?'),
  array['ExponentPushToken[owner-phone-1]', 'ExponentPushToken[owner-phone-2]', 'ExponentPushToken[staff-phone-1]'],
  'A family''s message goes to every phone of the vendor''s people'
);
select results_eq(
  $$ select recipient_side, title from claim1 where body = 'Is June 12 open?' $$,
  $$ values ('vendor', 'Harjit K.') $$,
  'Titled with the family''s short name for the vendor'
);
select results_eq(
  $$ select recipient_side, title, tokens[1] from claim1 where body = 'Yes, it is!' $$,
  $$ values ('family', 'Push Hall', 'ExponentPushToken[family-phone-1]') $$,
  'The vendor''s reply goes to the family''s phones, titled with the business'
);
select is(
  (select data from claim1 where kind = 'phone'),
  '{}'::jsonb,
  'A shared phone number never goes on a lock screen'
);

set local role service_role;
select is(
  (select count(*)::int from public.claim_push_messages()),
  0,
  'Each message is claimed once'
);
reset role;

select * from finish();
rollback;
