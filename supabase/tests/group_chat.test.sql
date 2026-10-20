-- Group chat (A3, #126): threads in a wedding, who reads them, joining with
-- a link, @Wed asks and Wed's answers, leaving and account deletion.

begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

-- Wed's brain is on for these tests (the switch is off until #124; the last section turns it off)
update public.app_config set value = 'true' where key = 'wed_group_chat';

-- People: Asha (owns the wedding), Balwinder (editor), Charan (suggester),
-- Dev (a friend outside the wedding, joins with a link), Esha (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a6000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha@example.com'),
  ('b6000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder@example.com'),
  ('c6000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan@example.com'),
  ('d6000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev@example.com'),
  ('e6000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esha@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a6000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550601'),
  ('b6000000-0000-4000-8000-00000000000b', 'Balwinder Singh', 'Yuba City', '+15305550602'),
  ('c6000000-0000-4000-8000-00000000000c', 'Charan Gill', 'Fremont', '+15105550603'),
  ('d6000000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fresno', '+15595550604');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon, service_role;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select value::uuid from pg_temp.ids where name = p_name;
$$;
grant execute on function pg_temp.id to authenticated, anon, service_role;

set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'wedding', public.create_wedding(p_title => 'Jaspreet & Amrit')::text;
reset role;

insert into public.wedding_members (wedding_id, user_id, role) values
  (pg_temp.id('wedding'), 'b6000000-0000-4000-8000-00000000000b', 'editor'),
  (pg_temp.id('wedding'), 'c6000000-0000-4000-8000-00000000000c', 'suggester');

-- Starting a thread -------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.create_group_thread(pg_temp.id('wedding'), 'Family') $$,
  '42501', null,
  'Logged-out people cannot start a thread'
);
reset role;

set local role authenticated;
select pg_temp.as_user('c6000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.create_group_thread(pg_temp.id('wedding'), 'Family') $$,
  '42501', 'not_allowed',
  'A suggester cannot start a thread'
);

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.create_group_thread(pg_temp.id('wedding'), 'Family',
       array['d6000000-0000-4000-8000-00000000000d']::uuid[]) $$,
  '22023', 'not_in_wedding',
  'Only the wedding''s own members can be added directly'
);
select throws_ok(
  $$ select public.create_group_thread(pg_temp.id('wedding'), '   ') $$,
  '22023', 'invalid_name',
  'A thread needs a name'
);

insert into pg_temp.ids select 'family', public.create_group_thread(
  pg_temp.id('wedding'), ' Family ',
  array['b6000000-0000-4000-8000-00000000000b', 'c6000000-0000-4000-8000-00000000000c']::uuid[]
)::text;

select is(
  (select name from public.group_threads where id = pg_temp.id('family')),
  'Family',
  'The owner starts a thread, its name trimmed'
);
select set_eq(
  $$ select user_id from public.group_members where thread_id = pg_temp.id('family') $$,
  $$ values ('a6000000-0000-4000-8000-00000000000a'::uuid), ('b6000000-0000-4000-8000-00000000000b'),
            ('c6000000-0000-4000-8000-00000000000c') $$,
  'The thread starts with its creator and the members they picked'
);
select is(
  (select count(*)::integer from public.group_messages where thread_id = pg_temp.id('family') and kind = 'joined'),
  2,
  'Each person added gets a joined line'
);

-- Who reads what ----------------------------------------------------------------------

select pg_temp.as_user('e6000000-0000-4000-8000-00000000000e');
select is((select count(*)::integer from public.group_threads), 0, 'A stranger sees no threads');
select is((select count(*)::integer from public.group_messages), 0, 'A stranger reads no messages');
select is((select count(*)::integer from public.group_members_list(pg_temp.id('family'))), 0,
  'A stranger cannot list who is in a thread');
select throws_ok(
  $$ select public.send_group_message(pg_temp.id('family'), 'hi') $$,
  '42501', 'not_allowed',
  'A stranger cannot write in a thread'
);
select throws_ok(
  $$ insert into public.group_messages (thread_id, sender_user_id, sender_role, body)
     values (pg_temp.id('family'), 'e6000000-0000-4000-8000-00000000000e', 'member', 'hi') $$,
  '42501', null,
  'Nobody writes messages without the RPC'
);

-- Joining with a link -----------------------------------------------------------------

select pg_temp.as_user('c6000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.create_group_invite(pg_temp.id('family')) $$,
  '42501', 'not_allowed',
  'Someone who doesn''t edit the wedding cannot make a link'
);

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'token', public.create_group_invite(pg_temp.id('family'));
reset role;
select ok(
  not exists (select 1 from public.group_invites where token_hash = (select value from pg_temp.ids where name = 'token'))
  and exists (select 1 from public.group_invites
    where token_hash = encode(sha256(convert_to((select value from pg_temp.ids where name = 'token'), 'UTF8')), 'hex')),
  'Only a hash of the link is stored'
);

set local role anon;
select results_eq(
  $$ select status, thread_name, wedding_title, inviter_name, member_count
     from public.group_invite_preview((select value from pg_temp.ids where name = 'token')) $$,
  $$ values ('valid'::text, 'Family'::text, 'Jaspreet & Amrit'::text, 'Asha'::text, 3) $$,
  'Logged out, a link shows the thread, the wedding, who sent it and how many are in it'
);
select is(
  (select status from public.group_invite_preview('00000000000000000000000000000000')),
  'not_found',
  'An unknown link says not found'
);
select throws_ok(
  $$ select public.accept_group_invite((select value from pg_temp.ids where name = 'token')) $$,
  '42501', null,
  'Joining needs an account'
);
reset role;

set local role authenticated;
select pg_temp.as_user('d6000000-0000-4000-8000-00000000000d');
select is(
  public.accept_group_invite((select value from pg_temp.ids where name = 'token')),
  pg_temp.id('family'),
  'A friend outside the wedding joins with the link'
);
select ok(
  exists (select 1 from public.group_members
          where thread_id = pg_temp.id('family') and user_id = 'd6000000-0000-4000-8000-00000000000d'),
  'The link added them to the thread'
);
select public.accept_group_invite((select value from pg_temp.ids where name = 'token'));
reset role;
select is(
  (select uses from public.group_invites
   where token_hash = encode(sha256(convert_to((select value from pg_temp.ids where name = 'token'), 'UTF8')), 'hex')),
  1,
  'Joining again is harmless and doesn''t use the link up'
);
set local role authenticated;

select results_eq(
  $$ select name, wedding_role, can_manage, is_me from public.group_members_list(pg_temp.id('family'))
     where user_id in ('a6000000-0000-4000-8000-00000000000a', 'd6000000-0000-4000-8000-00000000000d')
     order by name $$,
  $$ values ('Asha Kaur'::text, 'owner'::text, true, false), ('Dev Sandhu', null, false, true) $$,
  'Members see names, who is in the wedding and who manages the thread'
);
select is((select count(*)::integer from public.group_threads), 1, 'The friend now sees the thread');
select is((select count(*)::integer from public.weddings), 0, 'Being in a thread doesn''t open the wedding''s plan');
select throws_ok(
  $$ select public.rename_group_thread(pg_temp.id('family'), 'Mine now') $$,
  '42501', 'not_allowed',
  'A friend cannot rename the thread'
);
select throws_ok(
  $$ select public.remove_group_member(pg_temp.id('family'), 'c6000000-0000-4000-8000-00000000000c') $$,
  '42501', 'not_allowed',
  'A friend cannot remove others'
);

-- Messages, unread and @Wed -----------------------------------------------------------

insert into pg_temp.ids select 'hello', public.send_group_message(pg_temp.id('family'), 'Who is doing the dhol?')::text;
select is(
  (select wed_ask from public.group_messages where id = pg_temp.id('hello')),
  null,
  'A message without @Wed doesn''t ask Wed'
);
insert into pg_temp.ids select 'not_a_tag', public.send_group_message(pg_temp.id('family'), 'mail me at dev@wedding.com or @Wedding')::text;
select is(
  (select wed_ask from public.group_messages where id = pg_temp.id('not_a_tag')),
  null,
  'An email address or a longer word isn''t a tag'
);
insert into pg_temp.ids select 'ask', public.send_group_message(
  pg_temp.id('family'), 'Hey @wed, dhol players near Yuba City under $800?', pg_temp.id('hello'))::text;
select is(
  (select wed_ask from public.group_messages where id = pg_temp.id('ask')),
  'waiting',
  'Tagging @Wed asks Wed'
);
select throws_ok(
  $$ select public.send_group_message(pg_temp.id('family'), '   ') $$,
  '22023', 'empty_message',
  'An empty message is refused'
);

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'other', public.create_group_thread(pg_temp.id('wedding'), 'Jaago crew')::text;
select throws_ok(
  $$ select public.send_group_message(pg_temp.id('other'), 'hi', pg_temp.id('hello')) $$,
  '22023', 'invalid_reply',
  'A reply quotes a message from the same thread'
);
select is(
  (select unread_count from public.my_group_threads() where id = pg_temp.id('family')),
  3,
  'The owner has the friend''s three messages unread'
);
select public.mark_group_read(pg_temp.id('family'));
select is(
  (select unread_count from public.my_group_threads() where id = pg_temp.id('family')),
  0,
  'Reading the thread clears it'
);
select is(
  (select last_sender_is_me from public.my_group_threads() where id = pg_temp.id('family')),
  false,
  'The list knows the last message was someone else''s'
);
select public.send_group_message(pg_temp.id('other'), 'Jaago plans here');
select is(
  (select last_sender_is_me from public.my_group_threads() where id = pg_temp.id('other')),
  true,
  '...or mine, so it can say "You:"'
);
reset role;

-- Wed answers ------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select * from public.claim_wed_asks() $$,
  '42501', null,
  'Only the server claims Wed''s asks'
);
reset role;

set local role service_role;
select results_eq(
  $$ select message_id, asker_name, all_in_wedding, jsonb_array_length(context), context -> 0 ->> 'body'
     from public.claim_wed_asks() $$,
  $$ values (pg_temp.id('ask'), 'Dev Sandhu'::text, false, 2, 'Who is doing the dhol?'::text) $$,
  'The brain gets the ask, who asked, the messages before it, and that a friend outside the wedding is listening'
);
select is_empty($$ select * from public.claim_wed_asks() $$, 'Each ask is claimed once');

insert into pg_temp.ids select 'answer', public.post_wed_reply(
  pg_temp.id('ask'), 'Three dhol players are free that day.',
  '{"vendorIds": ["11111111-1111-4111-8111-111111111111"]}')::text;
select results_eq(
  $$ select sender_role, sender_user_id, reply_to, data -> 'vendorIds' ->> 0
     from public.group_messages where id = pg_temp.id('answer') $$,
  $$ values ('wed'::text, null::uuid, pg_temp.id('ask'), '11111111-1111-4111-8111-111111111111'::text) $$,
  'Wed answers as a reply to the ask, with vendor cards'
);
select is(
  (select wed_ask from public.group_messages where id = pg_temp.id('ask')),
  'answered',
  'The ask is marked answered'
);
select throws_ok(
  $$ select public.post_wed_reply(pg_temp.id('ask'), 'Again') $$,
  'P0001', 'not_waiting',
  'Wed answers an ask once'
);
reset role;

-- Links that no longer work -----------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
update public.group_invites set revoked_at = now() where thread_id = pg_temp.id('family');
select pg_temp.as_user('e6000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.accept_group_invite((select value from pg_temp.ids where name = 'token')) $$,
  'P0001', 'invite_revoked',
  'A cancelled link no longer lets anyone in'
);

-- Leaving, removing, account deletion -------------------------------------------------

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
select public.remove_group_member(pg_temp.id('family'), 'd6000000-0000-4000-8000-00000000000d');
select is(
  (select count(*)::integer from public.group_messages
   where thread_id = pg_temp.id('family') and kind = 'left'
     and sender_user_id = 'd6000000-0000-4000-8000-00000000000d'),
  1,
  'A manager removes someone, with a left line'
);
select is(
  (select count(*)::integer from public.group_messages
   where thread_id = pg_temp.id('family') and sender_role = 'member'
     and sender_user_id = 'd6000000-0000-4000-8000-00000000000d'),
  3,
  'Their messages stay for the others'
);

select pg_temp.as_user('d6000000-0000-4000-8000-00000000000d');
select is((select count(*)::integer from public.group_messages), 0, 'Someone removed reads nothing more');

select pg_temp.as_user('b6000000-0000-4000-8000-00000000000b');
select public.send_group_message(pg_temp.id('family'), 'I will ask my cousin');
reset role;

delete from auth.users where id = 'b6000000-0000-4000-8000-00000000000b';
select is(
  (select count(*)::integer from public.group_messages where sender_user_id = 'b6000000-0000-4000-8000-00000000000b'),
  0,
  'Deleting an account deletes that person''s messages'
);
select is(
  (select count(*)::integer from public.group_members where user_id = 'b6000000-0000-4000-8000-00000000000b'),
  0,
  '...and their place in threads'
);

set local role authenticated;
select pg_temp.as_user('c6000000-0000-4000-8000-00000000000c');
select public.remove_group_member(pg_temp.id('family'), 'c6000000-0000-4000-8000-00000000000c');
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
select public.remove_group_member(pg_temp.id('family'), 'a6000000-0000-4000-8000-00000000000a');
reset role;
select is(
  (select count(*)::integer from public.group_threads where id = pg_temp.id('family')),
  0,
  'The last one out deletes the thread'
);

delete from public.weddings where id = pg_temp.id('wedding');
select is(
  (select count(*)::integer from public.group_threads where id = pg_temp.id('other')),
  0,
  'Deleting the wedding deletes its threads'
);

-- Wed before the brain is on -----------------------------------------------------------

reset role;
update public.app_config set value = 'false' where key = 'wed_group_chat';
set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'late_wedding', public.create_wedding(p_title => 'Late', p_events => array['reception'])::text;
insert into pg_temp.ids select 'late', public.create_group_thread(pg_temp.id('late_wedding'), 'Family')::text;
insert into pg_temp.ids select 'early_ask', public.send_group_message(pg_temp.id('late'), '@Wed can you help?')::text;
select results_eq(
  $$ select (select wed_ask from public.group_messages where id = pg_temp.id('early_ask')),
            (select sender_role from public.group_messages where reply_to = pg_temp.id('early_ask')) $$,
  $$ values ('answered'::text, 'wed'::text) $$,
  'Before the brain is on, @Wed gets Wed''s reply at once that it can''t help here yet'
);

select * from finish();
rollback;
