-- Sharing a plan like Google Drive: the owner, editors who change the plan,
-- and suggesters who suggest vendors that the owner or an editor accepts
-- (the vendor is booked) or declines.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- People: Asha (owner), Balwinder (editor), Charan (suggester), Dev (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a9000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-r@example.com'),
  ('b9000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder-r@example.com'),
  ('c9000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan-r@example.com'),
  ('d9000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-r@example.com');

insert into public.vendors (id, slug, status, name, city, location) values
  ('99000000-0000-4000-8000-000000000001', 'roles-hall', 'published', 'Roles Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('99000000-0000-4000-8000-000000000002', 'roles-other-hall', 'published', 'Roles Other Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('99000000-0000-4000-8000-000000000003', 'roles-draft-hall', 'draft', 'Roles Draft Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

set local role authenticated;

-- Asha sets up the plan and invites an editor and a suggester
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'wedding', public.create_wedding(p_title => 'Roles test', p_events => array['reception'])::text;
insert into pg_temp.ids
select 'editor_invite', public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'), 'editor');
insert into pg_temp.ids
select 'suggester_invite', public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'), 'suggester');

select throws_ok(
  $$ select public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'), 'viewer') $$,
  '22023', 'invalid_role',
  'Invites are for editors or suggesters; viewer is gone'
);

select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select public.accept_wedding_invite((select value from pg_temp.ids where name = 'editor_invite'));
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select public.accept_wedding_invite((select value from pg_temp.ids where name = 'suggester_invite'));

select is(
  (select role from public.wedding_members where user_id = 'c9000000-0000-4000-8000-00000000000c'),
  'suggester',
  'A suggester link makes a suggester'
);

-- Suggesting ----------------------------------------------------------------------------

select throws_ok(
  $$ select public.set_booked((select value::uuid from pg_temp.ids where name = 'wedding'), 'reception', 'banquet-hall', true) $$,
  '42501', null,
  'A suggester cannot change the plan itself'
);

insert into pg_temp.ids
select 'suggestion', public.suggest_vendor(
  (select value::uuid from pg_temp.ids where name = 'wedding'), 'reception', 'banquet-hall',
  '99000000-0000-4000-8000-000000000001', '  Big parking lot  ')::text;

select results_eq(
  $$ select status, note, suggested_by::text from public.suggestions
     where id = (select value::uuid from pg_temp.ids where name = 'suggestion') $$,
  $$ values ('open'::text, 'Big parking lot'::text, 'c9000000-0000-4000-8000-00000000000c'::text) $$,
  'but can suggest a vendor for an event, with a note'
);

select is(
  public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'), 'reception',
    'banquet-hall', '99000000-0000-4000-8000-000000000001')::text,
  (select value from pg_temp.ids where name = 'suggestion'),
  'Suggesting the same vendor again returns the open suggestion'
);

select throws_ok(
  $$ select public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'), 'jaago',
       'banquet-hall', '99000000-0000-4000-8000-000000000001') $$,
  'P0002', 'event_not_in_plan',
  'Only for events in the plan'
);

select throws_ok(
  $$ select public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'), 'reception',
       'banquet-hall', '99000000-0000-4000-8000-000000000003') $$,
  'P0002', 'vendor_not_found',
  'and only published vendors'
);

-- Strangers -------------------------------------------------------------------------------

select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'), 'reception',
       'banquet-hall', '99000000-0000-4000-8000-000000000002') $$,
  '42501', 'not_allowed',
  'Someone outside the plan cannot suggest'
);
select is(
  (select count(*)::int from public.suggestions),
  0,
  'or see the suggestions'
);

-- Deciding --------------------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.resolve_suggestion((select value::uuid from pg_temp.ids where name = 'suggestion'), true) $$,
  '42501', 'not_allowed',
  'A suggester cannot accept their own suggestion'
);

select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select is(
  (select count(*)::int from public.suggestions),
  1,
  'Editors see the suggestions'
);
select public.resolve_suggestion((select value::uuid from pg_temp.ids where name = 'suggestion'), true);
select results_eq(
  $$ select b.vendor_id::text, b.booked_by::text from public.bookings b
     join public.wedding_slots s on s.id = b.slot_id
     join public.wedding_events we on we.id = s.wedding_event_id
     where we.event_slug = 'reception' and s.category_slug = 'banquet-hall' $$,
  $$ values ('99000000-0000-4000-8000-000000000001'::text, 'b9000000-0000-4000-8000-00000000000b'::text) $$,
  'Accepting books the vendor in the plan'
);
select results_eq(
  $$ select status, resolved_by::text from public.suggestions
     where id = (select value::uuid from pg_temp.ids where name = 'suggestion') $$,
  $$ values ('accepted'::text, 'b9000000-0000-4000-8000-00000000000b'::text) $$,
  'and marks the suggestion accepted, by whom'
);
select throws_ok(
  $$ select public.resolve_suggestion((select value::uuid from pg_temp.ids where name = 'suggestion'), false) $$,
  'P0001', 'already_resolved',
  'A decided suggestion stays decided'
);

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
insert into pg_temp.ids
select 'second', public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'),
  'reception', 'banquet-hall', '99000000-0000-4000-8000-000000000002')::text;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select public.resolve_suggestion((select value::uuid from pg_temp.ids where name = 'second'), false);
select is(
  (select b.vendor_id::text from public.bookings b
   join public.wedding_slots s on s.id = b.slot_id
   join public.wedding_events we on we.id = s.wedding_event_id
   where we.event_slug = 'reception' and s.category_slug = 'banquet-hall'),
  '99000000-0000-4000-8000-000000000001',
  'Declining leaves the plan as it was'
);

-- Withdrawing -----------------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
insert into pg_temp.ids
select 'third', public.suggest_vendor((select value::uuid from pg_temp.ids where name = 'wedding'),
  'reception', 'caterer', '99000000-0000-4000-8000-000000000002')::text;
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select public.withdraw_suggestion((select value::uuid from pg_temp.ids where name = 'third'));
select is(
  (select count(*)::int from public.suggestions where id = (select value::uuid from pg_temp.ids where name = 'third')),
  1,
  'Nobody can withdraw someone else''s suggestion'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select public.withdraw_suggestion((select value::uuid from pg_temp.ids where name = 'third'));
select is(
  (select count(*)::int from public.suggestions where id = (select value::uuid from pg_temp.ids where name = 'third')),
  0,
  'but you can take back your own'
);

-- Roles -----------------------------------------------------------------------------------

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select public.set_wedding_member_role((select value::uuid from pg_temp.ids where name = 'wedding'),
  'c9000000-0000-4000-8000-00000000000c', 'editor');
select is(
  (select role from public.wedding_members where user_id = 'c9000000-0000-4000-8000-00000000000c'),
  'editor',
  'The owner can make a suggester an editor, like changing access in Google Drive'
);

select * from finish();
rollback;
