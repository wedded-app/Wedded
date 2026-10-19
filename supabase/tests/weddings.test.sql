-- Plan together: weddings, sides, members, events, slots, bookings and invites.
-- Who can see and change what, joining with invites, and what happens when
-- people leave.

begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- People: Asha (sets up the wedding), Balwinder (joins as an editor),
-- Charan (joins as a suggester), Dev (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a2000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha@example.com'),
  ('b2000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder@example.com'),
  ('c2000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan@example.com'),
  ('d2000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a2000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550201'),
  ('b2000000-0000-4000-8000-00000000000b', 'Balwinder Singh', 'Yuba City', '+15305550202'),
  ('c2000000-0000-4000-8000-00000000000c', 'Charan Gill', 'Fremont', '+15105550203');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

-- Creating --------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.create_wedding('Test') $$,
  '42501', null,
  'Logged-out people cannot create a wedding'
);
reset role;

set local role authenticated;
select pg_temp.as_user('a2000000-0000-4000-8000-00000000000a');

insert into pg_temp.ids
select 'wedding', public.create_wedding(
  p_title => 'Jaspreet & Amrit',
  p_wedding_date => '2027-06-12',
  p_planning_for => 'child',
  p_cultures => array['punjabi-sikh', 'not-a-tradition'],
  p_events => array['reception', 'jaago'],
  p_guests => '{"jaago": "100_250", "reception": "lots"}',
  p_booked => '{"reception": ["banquet-hall", "dj"], "jaago": ["dhol"], "roka": ["caterer"]}'
)::text;

select is(
  (select role from public.wedding_members
   where wedding_id = (select value::uuid from pg_temp.ids where name = 'wedding')
     and user_id = 'a2000000-0000-4000-8000-00000000000a'),
  'owner',
  'Whoever creates a wedding is its owner'
);

select set_eq(
  $$ select event_slug from public.wedding_events $$,
  array['reception', 'jaago'],
  'The plan from the phone comes across: its events'
);

select set_eq(
  $$ select we.event_slug || '/' || s.category_slug
     from public.bookings b
     join public.wedding_slots s on s.id = b.slot_id
     join public.wedding_events we on we.id = s.wedding_event_id $$,
  array['reception/banquet-hall', 'reception/dj', 'jaago/dhol'],
  'and what was booked, only for events they''re having'
);

select results_eq(
  $$ select (select array_agg(culture_slug) from public.wedding_cultures),
       (select array_agg(event_slug || '=' || coalesce(guest_band, '-') order by event_slug) from public.wedding_events) $$,
  $$ values (array['punjabi-sikh'], array['jaago=100_250', 'reception=-']) $$,
  'and its traditions and guest counts, skipping ones that don''t exist'
);

select results_eq(
  $$ select s.side_key || ' ' || s.label || ' hosts ' || coalesce(string_agg(we.event_slug, ','), 'nothing')
     from public.wedding_sides s
     left join public.wedding_events we on we.side_id = s.id
     group by s.side_key, s.label order by s.side_key $$,
  $$ values ('a Bride''s side hosts nothing'::text), ('b Groom''s side hosts reception') $$,
  'A wedding has two sides; the reception is the groom''s side''s, and a jaago (each side has one) is shared'
);

select is(
  (select planning_for from public.profiles where id = 'a2000000-0000-4000-8000-00000000000a'),
  'child',
  'Who they''re planning for goes on their profile'
);

-- Strangers see nothing --------------------------------------------------------------

select pg_temp.as_user('d2000000-0000-4000-8000-00000000000d');
select is(
  (select count(*)::int from public.weddings) + (select count(*)::int from public.wedding_events)
    + (select count(*)::int from public.wedding_slots) + (select count(*)::int from public.bookings)
    + (select count(*)::int from public.wedding_sides) + (select count(*)::int from public.wedding_cultures)
    + (select count(*)::int from public.wedding_members),
  0,
  'Someone who isn''t a member sees no wedding, events, slots, bookings, sides, traditions or members'
);
select is(
  (select count(*)::int from public.wedding_members_list((select value::uuid from pg_temp.ids where name = 'wedding'))),
  0,
  'and gets no member names'
);

-- Invites ------------------------------------------------------------------------------

select pg_temp.as_user('a2000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'editor_invite', public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'));
insert into pg_temp.ids
select 'suggester_invite', public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'), 'suggester');

select ok(
  (select value ~ '^[0-9a-f]{32}$' from pg_temp.ids where name = 'editor_invite'),
  'An invite is a 32-character unguessable token'
);
reset role;

select is(
  (select count(*)::int from public.wedding_invites i
   join pg_temp.ids t on t.name in ('editor_invite', 'suggester_invite')
     and i.token_hash = encode(sha256(convert_to(t.value, 'UTF8')), 'hex')),
  2,
  'The database keeps only a hash of each link''s token'
);

set local role anon;
select results_eq(
  $$ select status, title, inviter_name, role
     from public.wedding_invite_preview((select value from pg_temp.ids where name = 'editor_invite')) $$,
  $$ values ('valid'::text, 'Jaspreet & Amrit'::text, 'Asha'::text, 'editor'::text) $$,
  'Before joining, anyone with the link sees the title and the inviter''s first name only'
);
select is(
  (select status from public.wedding_invite_preview('0123456789abcdef0123456789abcdef')),
  'not_found',
  'A made-up token finds nothing'
);
reset role;

set local role authenticated;
select pg_temp.as_user('b2000000-0000-4000-8000-00000000000b');
select is(
  public.accept_wedding_invite((select value from pg_temp.ids where name = 'editor_invite'))::text,
  (select value from pg_temp.ids where name = 'wedding'),
  'Joining with the link returns the wedding'
);
select is(
  (select role from public.wedding_members where user_id = 'b2000000-0000-4000-8000-00000000000b'),
  'editor',
  'and the person joins with the link''s role'
);
select is(
  public.accept_wedding_invite((select value from pg_temp.ids where name = 'editor_invite'))::text,
  (select value from pg_temp.ids where name = 'wedding'),
  'Joining again is harmless'
);

-- Editors change things; suggesters can only suggest --------------------------------------------

select public.set_booked((select value::uuid from pg_temp.ids where name = 'wedding'), 'jaago', 'photographer', true);
select is(
  (select b.booked_by from public.bookings b
   join public.wedding_slots s on s.id = b.slot_id where s.category_slug = 'photographer'),
  'b2000000-0000-4000-8000-00000000000b'::uuid,
  'An editor can tick off a booking, and it records who did'
);

select public.set_booked((select value::uuid from pg_temp.ids where name = 'wedding'), 'jaago', 'dhol', false);
select is(
  (select count(*)::int from public.bookings b
   join public.wedding_slots s on s.id = b.slot_id where s.category_slug = 'dhol'),
  0,
  'and untick one, which removes the booking'
);

select public.set_wedding_cultures((select value::uuid from pg_temp.ids where name = 'wedding'), '{punjabi-sikh,pakistani}');
select set_eq(
  $$ select culture_slug from public.wedding_cultures $$,
  array['punjabi-sikh', 'pakistani'],
  'An editor can set the wedding''s traditions'
);

select pg_temp.as_user('c2000000-0000-4000-8000-00000000000c');
select lives_ok(
  $$ select public.accept_wedding_invite((select value from pg_temp.ids where name = 'suggester_invite')) $$,
  'A suggester link lets a relative join'
);
select throws_ok(
  $$ select public.set_booked((select value::uuid from pg_temp.ids where name = 'wedding'), 'jaago', 'caterer', true) $$,
  '42501', null,
  'A suggester cannot change the plan'
);
update public.weddings set wedding_date = '2027-01-01';
select is(
  (select wedding_date from public.weddings),
  '2027-06-12'::date,
  'A suggester''s change to the date does nothing'
);
select throws_ok(
  $$ select public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding')) $$,
  '42501', null,
  'A suggester cannot invite more people'
);
select results_eq(
  $$ select name, role from public.wedding_members_list((select value::uuid from pg_temp.ids where name = 'wedding')) $$,
  $$ values ('Asha Kaur'::text, 'owner'::text), ('Balwinder Singh', 'editor'), ('Charan Gill', 'suggester') $$,
  'Members see each other''s names, owner first'
);
select throws_ok(
  $$ select public.remove_wedding_member(
       (select value::uuid from pg_temp.ids where name = 'wedding'),
       'b2000000-0000-4000-8000-00000000000b') $$,
  '42501', null,
  'Only the owner can remove someone else'
);

-- Closed links -------------------------------------------------------------------------

select pg_temp.as_user('a2000000-0000-4000-8000-00000000000a');
update public.wedding_invites set revoked_at = now()
where token_hash = (select encode(sha256(convert_to(value, 'UTF8')), 'hex') from pg_temp.ids where name = 'suggester_invite');

select pg_temp.as_user('d2000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.accept_wedding_invite((select value from pg_temp.ids where name = 'suggester_invite')) $$,
  'P0001', 'invite_revoked',
  'A cancelled link no longer works'
);
reset role;
update public.wedding_invites set expires_at = now() - interval '1 minute'
where token_hash = (select encode(sha256(convert_to(value, 'UTF8')), 'hex') from pg_temp.ids where name = 'editor_invite');
set local role authenticated;
select pg_temp.as_user('d2000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.accept_wedding_invite((select value from pg_temp.ids where name = 'editor_invite')) $$,
  'P0001', 'invite_expired',
  'An expired link no longer works'
);

-- Leaving ------------------------------------------------------------------------------

select pg_temp.as_user('a2000000-0000-4000-8000-00000000000a');
select public.remove_wedding_member(
  (select value::uuid from pg_temp.ids where name = 'wedding'),
  'a2000000-0000-4000-8000-00000000000a');
reset role;
select is(
  (select user_id from public.wedding_members where role = 'owner'),
  'b2000000-0000-4000-8000-00000000000b'::uuid,
  'When the owner leaves, the longest-standing editor becomes the owner'
);

delete from auth.users where id = 'b2000000-0000-4000-8000-00000000000b';
select is(
  (select user_id from public.wedding_members where role = 'owner'),
  'c2000000-0000-4000-8000-00000000000c'::uuid,
  'When an owner deletes their account, the next member takes over'
);
select is(
  (select b.booked_by from public.bookings b
   join public.wedding_slots s on s.id = b.slot_id where s.category_slug = 'photographer'),
  null::uuid,
  'and their name comes off what they changed'
);

set local role authenticated;
select pg_temp.as_user('c2000000-0000-4000-8000-00000000000c');
select public.remove_wedding_member(
  (select value::uuid from pg_temp.ids where name = 'wedding'),
  'c2000000-0000-4000-8000-00000000000c');
reset role;
select is(
  (select count(*)::int from public.weddings where id = (select value::uuid from pg_temp.ids where name = 'wedding')),
  0,
  'When the last member leaves, the wedding is deleted'
);
select is(
  (select count(*)::int from public.wedding_events) + (select count(*)::int from public.wedding_slots)
    + (select count(*)::int from public.bookings) + (select count(*)::int from public.wedding_sides)
    + (select count(*)::int from public.wedding_invites),
  0,
  'along with its events, slots, bookings, sides and links'
);

select * from finish();
rollback;
