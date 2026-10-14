-- Requests and proposals: families post, only Pro vendors who fit see them and
-- send one proposal each, free vendors get counts, and accepting opens a chat
-- the vendor can then reply in. Short name and town only.

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1500000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'req-family@example.com'),
  ('a1500000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'req-viewer@example.com'),
  ('a1500000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'req-pro@example.com'),
  ('a1500000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'req-free@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a1500000-0000-4000-8000-000000000001', 'Harjit Kaur Sandhu', 'Yuba City', '+15305550101');

-- kids-entertainment has no sample vendors, so only these fit
insert into public.vendors (id, slug, status, name, city, location, service_radius_miles) values
  ('b1500000-0000-4000-8000-000000000001', 'req-pro', 'published', 'Req Pro', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)', 25),
  ('b1500000-0000-4000-8000-000000000002', 'req-free', 'published', 'Req Free', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)', 25),
  ('b1500000-0000-4000-8000-000000000003', 'req-far', 'published', 'Req Far', 'Los Angeles', 'SRID=4326;POINT(-118.2437 34.0522)', 25);
insert into public.vendor_categories (vendor_id, category_slug, position) values
  ('b1500000-0000-4000-8000-000000000001', 'kids-entertainment', 1),
  ('b1500000-0000-4000-8000-000000000002', 'kids-entertainment', 1),
  ('b1500000-0000-4000-8000-000000000003', 'kids-entertainment', 1);
insert into public.vendor_members (vendor_id, user_id) values
  ('b1500000-0000-4000-8000-000000000001', 'a1500000-0000-4000-8000-00000000000e'),
  ('b1500000-0000-4000-8000-000000000002', 'a1500000-0000-4000-8000-00000000000f');
insert into public.vendor_subscriptions (vendor_id, status, current_period_end) values
  ('b1500000-0000-4000-8000-000000000001', 'active', now() + interval '20 days');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- The family's wedding, with a viewer who can't edit
set local role authenticated;
select pg_temp.as_user('a1500000-0000-4000-8000-000000000001');
create temp table wedding as
  select public.create_wedding(p_planning_for => 'self', p_wedding_date => '2027-06-12') as id;
grant select on wedding to public;
reset role;
insert into public.wedding_members (wedding_id, user_id, role)
select id, 'a1500000-0000-4000-8000-000000000002', 'suggester' from wedding;

-- Posting ---------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a1500000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.post_request((select id from wedding), 'kids-entertainment', 'Need a magician', 'yuba-city') $$,
  '42501', 'not_allowed',
  'Only owners and editors post requests'
);

select pg_temp.as_user('a1500000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.post_request((select id from wedding), 'kids-entertainment', 'Need a magician', 'atlantis') $$,
  '22023', 'invalid_city',
  'The town must be a real one'
);
select throws_ok(
  $$ select public.post_request((select id from wedding), 'kids-entertainment', 'x', 'yuba-city', p_event_date => '2020-01-01') $$,
  '22023', 'date_passed',
  'Not for a date already gone'
);
create temp table req as
  select public.post_request(
    (select id from wedding), 'kids-entertainment', '  A magician for the kids at the reception  ', 'yuba-city',
    p_event_slug => 'reception', p_event_date => '2027-06-12', p_guest_band => '250_500',
    p_budget_min_cents => 50000, p_budget_max_cents => 100000) as id;
grant select on req to public;
select results_eq(
  $$ select note, status, expires_at > now() from public.wedding_requests $$,
  $$ values ('A magician for the kids at the reception', 'open', true) $$,
  'A request is posted, tidied, open until after the event'
);
select throws_ok(
  $$ select public.post_request((select id from wedding), 'kids-entertainment', 'Again', 'yuba-city', p_event_slug => 'reception') $$,
  '23505', 'already_open',
  'One open request per vendor type and event'
);

-- Families looking ------------------------------------------------------------------------

select pg_temp.as_user('a1500000-0000-4000-8000-00000000000f');
select throws_ok(
  $$ select * from public.families_looking('b1500000-0000-4000-8000-000000000002') $$,
  '42501', 'pro_only',
  'Free vendors can''t open Families looking'
);
select results_eq(
  $$ select category_slug, open_requests from public.families_looking_summary('b1500000-0000-4000-8000-000000000002') $$,
  $$ values ('kids-entertainment', 1) $$,
  'but they see how many families nearby are looking (the teaser)'
);
select throws_ok(
  $$ select public.send_proposal((select id from req), 'b1500000-0000-4000-8000-000000000002', 'Hi') $$,
  '42501', 'pro_only',
  'and can''t send proposals'
);

select pg_temp.as_user('a1500000-0000-4000-8000-00000000000e');
select results_eq(
  $$ select family_name, city, guest_band, budget_max_cents, already_proposed, proposal_count
     from public.families_looking('b1500000-0000-4000-8000-000000000001') $$,
  $$ values ('Harjit K.', 'Yuba City', '250_500', 100000, false, 0) $$,
  'A Pro vendor sees the request with the short name and town only'
);
select is(
  (select count(*)::int from public.families_looking('b1500000-0000-4000-8000-000000000001', p_category_slug => 'dj')),
  0,
  'Filtering by another vendor type shows nothing'
);
select is(
  (select count(*)::int from public.wedding_requests),
  0,
  'Vendors can''t read requests directly'
);

-- Proposals -------------------------------------------------------------------------------

select throws_ok(
  $$ select public.send_proposal((select id from req), 'b1500000-0000-4000-8000-000000000001', 'Hi', 50000, null) $$,
  '22023', 'invalid_price',
  'A price needs its unit'
);
create temp table prop as
  select public.send_proposal((select id from req), 'b1500000-0000-4000-8000-000000000001',
    'Magic show and balloon animals, 45 minutes', 60000, 'event') as id;
grant select on prop to public;
select throws_ok(
  $$ select public.send_proposal((select id from req), 'b1500000-0000-4000-8000-000000000001', 'Again') $$,
  '23505', 'already_sent',
  'One proposal per vendor per request'
);
select is(
  (select already_proposed from public.families_looking('b1500000-0000-4000-8000-000000000001')),
  true,
  'The feed shows they already answered'
);
select throws_ok(
  $$ select public.send_message(
       (select id from public.conversations where vendor_id = 'b1500000-0000-4000-8000-000000000001' limit 1),
       'text', 'Hello?') $$,
  '42501', 'not_allowed',
  'No chat exists before the family accepts'
);

select pg_temp.as_user('a1500000-0000-4000-8000-000000000001');
select results_eq(
  $$ select vendor_slug, price_cents, price_unit, status from public.request_proposals_for((select id from req)) $$,
  $$ values ('req-pro', 60000, 'event', 'sent') $$,
  'The family sees the proposal with the vendor'
);
create temp table accepted as select public.answer_proposal((select id from prop), true) as convo;
grant select on accepted to public;
select results_eq(
  $$ select sender_role, kind, data ->> 'update' from public.messages
     where conversation_id = (select convo from accepted) order by created_at $$,
  $$ values ('vendor', 'proposal', null::text), ('family', 'proposal', 'accepted') $$,
  'Accepting opens the chat with the proposal and the family''s yes'
);
select throws_ok(
  $$ select public.answer_proposal((select id from prop), false) $$,
  'P0001', 'already_answered',
  'A proposal is answered once'
);

select pg_temp.as_user('a1500000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message((select convo from accepted), 'text', 'Thank you! What time is the reception?') $$,
  'The vendor can now reply in the chat'
);
select throws_ok(
  $$ select public.withdraw_proposal((select id from prop)) $$,
  'P0001', 'already_answered',
  'An accepted proposal can''t be withdrawn'
);

-- Closing ---------------------------------------------------------------------------------

select pg_temp.as_user('a1500000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.close_request((select id from req), true) $$,
  'The family marks it booked'
);
select pg_temp.as_user('a1500000-0000-4000-8000-00000000000e');
select is(
  (select count(*)::int from public.families_looking('b1500000-0000-4000-8000-000000000001')),
  0,
  'A booked request leaves Families looking'
);
reset role;
select is(
  (select status from public.wedding_requests),
  'booked',
  'It''s marked booked'
);

select * from finish();
rollback;
