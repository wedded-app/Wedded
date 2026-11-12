-- Report and block in chat: only a chat you're in, and a blocked chat takes
-- no messages from either side until the blocker unblocks it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a5000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'safety-family@example.com'),
  ('a5000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'safety-vendor@example.com'),
  ('a5000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'safety-stranger@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b5000000-0000-4000-8000-000000000001', 'safety-dhol', 'published', 'Safety Dhol', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-00000000000e');
insert into public.conversations (id, vendor_id, family_user_id, family_label) values
  ('c5000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Harjit K.');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.as_user('a5000000-0000-4000-8000-00000000000f');
select throws_ok(
  $$ select public.report_chat('c5000000-0000-4000-8000-000000000001', null, 'spam', null) $$,
  '42501', 'not_allowed',
  'A stranger can''t report a chat they aren''t in'
);
select throws_ok(
  $$ select public.block_chat('c5000000-0000-4000-8000-000000000001', true) $$,
  '42501', 'not_allowed',
  'Or block it'
);

select pg_temp.as_user('a5000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.report_chat('c5000000-0000-4000-8000-000000000001', null, 'harassment', '  rude  ') $$,
  'The family reports the chat'
);
select lives_ok(
  $$ select public.send_message('c5000000-0000-4000-8000-000000000001', 'text', 'Hello', '{}') $$,
  'Before blocking, the family can write'
);
select lives_ok(
  $$ select public.block_chat('c5000000-0000-4000-8000-000000000001', true) $$,
  'The family blocks the chat'
);
select throws_ok(
  $$ select public.send_message('c5000000-0000-4000-8000-000000000001', 'text', 'Again', '{}') $$,
  'P0001', 'chat_blocked',
  'A blocked chat takes nothing from the family'
);

select pg_temp.as_user('a5000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.send_message('c5000000-0000-4000-8000-000000000001', 'text', 'Reply', '{}') $$,
  'P0001', 'chat_blocked',
  'Or from the vendor, who can''t unblock it for them'
);
reset role;

select is(
  (select note from public.chat_reports where conversation_id = 'c5000000-0000-4000-8000-000000000001'),
  'rude',
  'The report is kept for the founders, note trimmed'
);

select * from finish();
rollback;
