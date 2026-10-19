-- Deposits: only a vendor whose Stripe account is ready asks, only in a chat
-- the family started; only that family pays; Stripe's webhook moves it forward
-- once, and the chat says so.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1300000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dep-family@example.com'),
  ('a1300000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dep-other-family@example.com'),
  ('a1300000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dep-owner@example.com');
insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b1300000-0000-4000-8000-000000000001', 'dep-hall', 'published', 'Dep Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-00000000000e');
insert into public.conversations (id, vendor_id, family_user_id, family_name) values
  ('c1300000-0000-4000-8000-000000000001', 'b1300000-0000-4000-8000-000000000001',
   'a1300000-0000-4000-8000-000000000001', 'Harjit K.');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Asking ----------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a1300000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.request_deposit('c1300000-0000-4000-8000-000000000001', 50000) $$,
  '42501', 'family_first',
  'A vendor can''t ask before the family has written'
);
reset role;

insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body)
values ('c1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', 'family', 'text', 'Is June 12 open?');

set local role authenticated;
select pg_temp.as_user('a1300000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.request_deposit('c1300000-0000-4000-8000-000000000001', 50000) $$,
  'P0001', 'payments_not_ready',
  'Not before their Stripe account can take payments'
);
select throws_ok(
  $$ insert into public.vendor_payment_accounts (vendor_id, stripe_account_id, charges_enabled)
     values ('b1300000-0000-4000-8000-000000000001', 'acct_fake123', true) $$,
  '42501', null,
  'Nobody marks their own account ready'
);
reset role;

set local role service_role;
select lives_ok(
  $$ select public.save_payment_account('b1300000-0000-4000-8000-000000000001', 'acct_1TestHall', false, true, false);
     select public.update_payment_account('acct_1TestHall', true, true) $$,
  'The Edge Functions save the connected account and Stripe''s word that it''s ready'
);
reset role;

set local role authenticated;
select pg_temp.as_user('a1300000-0000-4000-8000-00000000000e');
select is(
  (select charges_enabled from public.vendor_payment_accounts),
  true,
  'The vendor''s people see their account is ready'
);
select throws_ok(
  $$ select public.request_deposit('c1300000-0000-4000-8000-000000000001', 50) $$,
  '22023', 'invalid_amount',
  'At least $1'
);
select throws_ok(
  $$ select public.request_deposit('c1300000-0000-4000-8000-000000000001', 50000, 'not-an-event') $$,
  '22023', 'invalid_event',
  'Only real events'
);
create temp table asked as
  select public.request_deposit('c1300000-0000-4000-8000-000000000001', 50000, 'reception', '  Holds June 12  ') as id;
grant select on asked to service_role;
select results_eq(
  $$ select amount_cents, event_slug, note, status, stripe_account_id from public.deposits $$,
  $$ values (50000, 'reception', 'Holds June 12', 'requested', 'acct_1TestHall') $$,
  'A $500 deposit for the reception is asked for, tidied'
);
select is(
  (select data ->> 'depositId' from public.messages where kind = 'deposit'),
  (select id::text from asked),
  'The request shows in the chat'
);
select throws_ok(
  $$ select public.send_message('c1300000-0000-4000-8000-000000000001', 'deposit', null, '{}') $$,
  '22023', 'invalid_kind',
  'Nobody makes a deposit message by hand'
);
reset role;

-- Who sees it ----------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a1300000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.deposits), 1, 'The family sees it');
select pg_temp.as_user('a1300000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.deposits), 0, 'Another family doesn''t');
reset role;

-- Paying ---------------------------------------------------------------------------------

set local role service_role;
select throws_ok(
  $$ select * from public.deposit_for_payment((select id from asked), 'a1300000-0000-4000-8000-000000000002') $$,
  '42501', 'not_allowed',
  'Only that family can pay it'
);
select results_eq(
  $$ select amount_cents, stripe_account_id, vendor_name, event_name
     from public.deposit_for_payment((select id from asked), 'a1300000-0000-4000-8000-000000000001') $$,
  $$ values (50000, 'acct_1TestHall', 'Dep Hall', (select name ->> 'en' from public.events where slug = 'reception')) $$,
  'The family''s payment gets the amount, the vendor''s account and names'
);
select public.attach_payment_intent((select id from asked), 'pi_test_1');
select is(
  public.record_deposit_payment('pi_test_1', 'paid'),
  true,
  'Stripe says it''s paid'
);
select is(
  public.record_deposit_payment('pi_test_1', 'paid'),
  false,
  'A repeated webhook changes nothing'
);
select is(
  public.record_deposit_payment('pi_test_1', 'failed'),
  false,
  'A late failure can''t undo a payment'
);
reset role;

select results_eq(
  $$ select status, paid_at is not null from public.deposits $$,
  $$ values ('paid', true) $$,
  'The deposit is paid'
);
select is(
  (select count(*)::int from public.messages where kind = 'deposit' and sender_role = 'system' and data ->> 'update' = 'paid'),
  1,
  'The chat says it was paid, once'
);

set local role authenticated;
select pg_temp.as_user('a1300000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.cancel_deposit((select id from public.deposits limit 1)) $$,
  'P0001', 'not_cancelable',
  'A paid deposit can''t be canceled in the app'
);
reset role;

select * from finish();
rollback;
