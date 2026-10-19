-- Chat notifications: one email per side for messages left unread past the
-- quiet period, never twice, and only the service role can claim them.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a7000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notify-family@example.com'),
  ('a7000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notify-owner@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b7000000-0000-4000-8000-000000000001', 'notify-hall', 'published', 'Notify Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('b7000000-0000-4000-8000-000000000002', 'notify-dj', 'published', 'Notify DJ', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000e');
insert into public.vendor_private (vendor_id, email, checks_email) values
  ('b7000000-0000-4000-8000-000000000002', 'dj@example.com', true);

-- A family wrote to the hall (has an account) and the DJ (no account) 10 minutes ago
insert into public.conversations (id, vendor_id, family_user_id, family_name, last_message_at, family_read_at) values
  ('d7000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000f', 'Harjit K.', now() - interval '10 minutes', now() - interval '10 minutes'),
  ('d7000000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-00000000000f', 'Harjit K.', now() - interval '10 minutes', now() - interval '10 minutes');
insert into public.messages (conversation_id, sender_user_id, sender_role, body, created_at) values
  ('d7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000f', 'family', 'Is June 12 open?', now() - interval '10 minutes'),
  ('d7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-00000000000f', 'family', 'Are you free June 12?', now() - interval '10 minutes');

set local role authenticated;
select throws_ok($$ select * from public.claim_chat_notifications() $$, '42501', null,
  'Only the service role can claim notifications');
reset role;

set local role service_role;
create temp table claims as select * from public.claim_chat_notifications(3);
reset role;

select results_eq(
  $$ select notify_side, recipients, vendor_has_account, unread_count, last_body from claims
     where conversation_id = 'd7000000-0000-4000-8000-000000000001' $$,
  $$ values ('vendor'::text, array['notify-owner@example.com'], true, 1, 'Is June 12 open?'::text) $$,
  'A vendor with an account is emailed at their account''s address'
);
select results_eq(
  $$ select recipients, vendor_has_account from claims where conversation_id = 'd7000000-0000-4000-8000-000000000002' $$,
  $$ values (array['dj@example.com'], false) $$,
  'A vendor without an account is emailed at their listing email (to invite them to claim it)'
);

set local role service_role;
select is((select count(*)::int from public.claim_chat_notifications(3)), 0, 'Nobody is emailed twice for the same messages');
reset role;

-- The vendor replies; the family doesn't read it for 10 minutes
insert into public.messages (conversation_id, sender_user_id, sender_role, body, created_at) values
  ('d7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000e', 'vendor', 'Yes, it''s open!', now() - interval '5 minutes');
update public.conversations set vendor_read_at = now() - interval '5 minutes', last_message_at = now() - interval '5 minutes'
where id = 'd7000000-0000-4000-8000-000000000001';

set local role service_role;
select results_eq(
  $$ select notify_side, recipients from public.claim_chat_notifications(3) $$,
  $$ values ('family'::text, array['notify-family@example.com']) $$,
  'The family is emailed when the vendor''s reply sits unread'
);
reset role;

-- A message read within the quiet period sends nothing
insert into public.messages (conversation_id, sender_user_id, sender_role, body, created_at) values
  ('d7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-00000000000f', 'family', 'Great, see you Saturday', now() - interval '4 minutes');
update public.conversations set vendor_read_at = now() - interval '3 minutes 30 seconds', last_message_at = now() - interval '4 minutes'
where id = 'd7000000-0000-4000-8000-000000000001';
set local role service_role;
select is((select count(*)::int from public.claim_chat_notifications(3)), 0, 'Messages already read send nothing');
-- and a brand-new message waits for the quiet period
reset role;
insert into public.messages (conversation_id, sender_user_id, sender_role, body, created_at) values
  ('d7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-00000000000f', 'family', 'Hello again', now());
update public.conversations set last_message_at = now() where id = 'd7000000-0000-4000-8000-000000000002';
set local role service_role;
select is((select count(*)::int from public.claim_chat_notifications(3)), 0, 'A brand-new message waits a few minutes in case they reply live');
reset role;

select * from finish();
rollback;
