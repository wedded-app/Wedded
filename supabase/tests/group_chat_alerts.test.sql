-- Group chat photos, push alerts and emails (group_chat_alerts): photos stay
-- in the thread's folder, each message buzzes everyone else once, and each
-- member gets one email per thread until they've read it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- Asha (owns the wedding), Balwinder (editor), Dev (a friend who signed in
-- with a phone, so no email), Esha (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a7100000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha@example.com'),
  ('b7100000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder@example.com'),
  ('d7100000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null),
  ('e7100000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esha@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a7100000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550711'),
  ('b7100000-0000-4000-8000-00000000000b', 'Balwinder Singh', 'Yuba City', '+15305550712'),
  ('d7100000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fresno', '+15595550714');

insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[ashaphone0001]', 'a7100000-0000-4000-8000-00000000000a', 'ios'),
  ('ExponentPushToken[balwinder0001]', 'b7100000-0000-4000-8000-00000000000b', 'android');

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
select pg_temp.as_user('a7100000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'wedding', public.create_wedding(p_title => 'Jaspreet & Amrit')::text;
reset role;
insert into public.wedding_members (wedding_id, user_id, role) values
  (pg_temp.id('wedding'), 'b7100000-0000-4000-8000-00000000000b', 'editor'),
  (pg_temp.id('wedding'), 'd7100000-0000-4000-8000-00000000000d', 'suggester');

set local role authenticated;
insert into pg_temp.ids select 'family', public.create_group_thread(
  pg_temp.id('wedding'), 'Family',
  array['b7100000-0000-4000-8000-00000000000b', 'd7100000-0000-4000-8000-00000000000d']::uuid[]
)::text;

-- Photos ------------------------------------------------------------------------------

select throws_ok(
  $$ select public.send_group_message(pg_temp.id('family'),
       p_photo => '{"path": "00000000-0000-4000-8000-000000000000/x.jpg"}') $$,
  '22023', 'invalid_photo',
  'A photo must be in the thread''s own folder'
);
select throws_ok(
  $$ select public.send_group_message(pg_temp.id('family')) $$,
  '22023', 'empty_message',
  'A message needs words or a photo'
);

insert into pg_temp.ids select 'text', public.send_group_message(pg_temp.id('family'), 'The stage, what do you think?')::text;
insert into pg_temp.ids select 'photo', public.send_group_message(
  pg_temp.id('family'),
  p_photo => jsonb_build_object('path', pg_temp.id('family')::text || '/stage.jpg', 'width', 1200, 'height', 900, 'extra', 'dropped')
)::text;

select results_eq(
  $$ select kind, body, data from public.group_messages where id = pg_temp.id('photo') $$,
  $$ values ('photo'::text, null::text,
       jsonb_build_object('path', pg_temp.id('family')::text || '/stage.jpg', 'width', 1200, 'height', 900)) $$,
  'A photo keeps its path and size, with no caption needed, and nothing else'
);
select ok(
  private.can_use_chat_object(pg_temp.id('family')::text || '/stage.jpg'),
  'Members can upload and read files in the thread''s folder'
);

select pg_temp.as_user('e7100000-0000-4000-8000-00000000000e');
select ok(
  not private.can_use_chat_object(pg_temp.id('family')::text || '/stage.jpg'),
  'A stranger cannot read the thread''s photos'
);

select pg_temp.as_user('b7100000-0000-4000-8000-00000000000b');
select is(
  (select unread_count from public.my_group_threads() where id = pg_temp.id('family')),
  2,
  'A photo counts as unread like a text'
);
reset role;

-- Push alerts ------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a7100000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select * from public.claim_group_push() $$,
  '42501', null,
  'Only the server claims group alerts'
);
reset role;

set local role service_role;
insert into pg_temp.ids select 'claim1', jsonb_agg(to_jsonb(c))::text from public.claim_group_push() c;
reset role;

select is(
  (select jsonb_array_length(value::jsonb) from pg_temp.ids where name = 'claim1'),
  2,
  'The text and the photo buzz; the joined lines don''t'
);
select results_eq(
  $$ select c ->> 'thread_name', c ->> 'sender_name', c ->> 'kind', c -> 'tokens'
     from jsonb_array_elements((select value::jsonb from pg_temp.ids where name = 'claim1')) c
     where c ->> 'message_id' = pg_temp.id('text')::text $$,
  $$ values ('Family'::text, 'Asha K.'::text, 'text'::text, '["ExponentPushToken[balwinder0001]"]'::jsonb) $$,
  'An alert names the thread and who wrote, and goes to everyone else''s phones, never the sender''s'
);

set local role service_role;
select is_empty($$ select * from public.claim_group_push() $$, 'Each message buzzes once');
reset role;

set local role authenticated;
select pg_temp.as_user('b7100000-0000-4000-8000-00000000000b');
insert into pg_temp.ids select 'ask', public.send_group_message(pg_temp.id('family'), '@Wed who does stages?')::text;
reset role;
set local role service_role;
select count(*) from public.claim_wed_asks();
insert into pg_temp.ids select 'answer', public.post_wed_reply(pg_temp.id('ask'), 'Three decorators do stages.')::text;
select results_eq(
  $$ select message_id, sender_name, cardinality(tokens) from public.claim_group_push() order by sender_name $$,
  $$ values (pg_temp.id('ask'), 'Balwinder S.'::text, 1), (pg_temp.id('answer'), 'Wed'::text, 2) $$,
  'Wed''s answer buzzes everyone in the thread'
);
reset role;

update public.group_messages set pushed_at = null, created_at = now() - interval '11 minutes'
where id = pg_temp.id('text');
set local role service_role;
select is_empty($$ select * from public.claim_group_push() $$, 'A message older than 10 minutes never buzzes late');
reset role;
select isnt(
  (select pushed_at from public.group_messages where id = pg_temp.id('text')),
  null,
  '...but is stamped so it''s never looked at again'
);

-- Emails ------------------------------------------------------------------------------

-- Everything was sent 10 minutes ago and nobody has read the thread since
update public.group_messages set created_at = created_at - interval '10 minutes' where thread_id = pg_temp.id('family');
update public.group_threads set last_message_at = now() - interval '10 minutes' where id = pg_temp.id('family');
update public.group_members set read_at = null where thread_id = pg_temp.id('family');

set local role authenticated;
select pg_temp.as_user('a7100000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select * from public.claim_group_notifications() $$,
  '42501', null,
  'Only the server claims group emails'
);
reset role;

set local role service_role;
insert into pg_temp.ids select 'mail1', jsonb_agg(to_jsonb(c))::text from public.claim_group_notifications(3) c;
reset role;

select set_eq(
  $$ select c ->> 'recipient' from jsonb_array_elements((select value::jsonb from pg_temp.ids where name = 'mail1')) c $$,
  $$ values ('asha@example.com'), ('balwinder@example.com') $$,
  'Members with unread messages get an email; a phone-only account is skipped'
);
select results_eq(
  $$ select c ->> 'thread_name', c ->> 'wedding_title', (c ->> 'unread_count')::integer, c ->> 'last_sender_name', c ->> 'last_body'
     from jsonb_array_elements((select value::jsonb from pg_temp.ids where name = 'mail1')) c
     where c ->> 'recipient' = 'asha@example.com' $$,
  $$ values ('Family'::text, 'Jaspreet & Amrit'::text, 2, 'Wed'::text, 'Three decorators do stages.'::text) $$,
  'The email says the thread, the wedding, how many are waiting from others, and the latest'
);

set local role service_role;
select is_empty($$ select * from public.claim_group_notifications(3) $$, 'One email until they read the thread');
reset role;

-- Asha read it 8 minutes ago (after the email); Balwinder wrote again 5 minutes ago
update public.group_members set notified_at = now() - interval '9 minutes', read_at = now() - interval '8 minutes'
where thread_id = pg_temp.id('family') and user_id = 'a7100000-0000-4000-8000-00000000000a';
insert into public.group_messages (thread_id, sender_user_id, sender_role, body, created_at, pushed_at)
values (pg_temp.id('family'), 'b7100000-0000-4000-8000-00000000000b', 'member', 'Booked the decorator!',
  now() - interval '5 minutes', now());

set local role service_role;
select results_eq(
  $$ select recipient, unread_count, last_body from public.claim_group_notifications(3) $$,
  $$ values ('asha@example.com'::text, 1, 'Booked the decorator!'::text) $$,
  'After reading, the next unread message emails again, counting only what''s new'
);
reset role;

insert into public.group_messages (thread_id, sender_user_id, sender_role, body, created_at, pushed_at)
values (pg_temp.id('family'), 'a7100000-0000-4000-8000-00000000000a', 'member', 'Great!', now(), now());
update public.group_members set notified_at = now() - interval '9 minutes', read_at = now() - interval '8 minutes'
where thread_id = pg_temp.id('family') and user_id = 'b7100000-0000-4000-8000-00000000000b';
set local role service_role;
select is_empty(
  $$ select * from public.claim_group_notifications(3) $$,
  'A message newer than the quiet minutes waits: they may still read it in the app'
);
reset role;

update public.group_threads set last_message_at = now() - interval '15 days' where id = pg_temp.id('family');
update public.group_messages set created_at = now() - interval '15 days' where thread_id = pg_temp.id('family');
set local role service_role;
select is_empty($$ select * from public.claim_group_notifications(3) $$, 'Threads quiet for 14 days are left alone');
reset role;

select is(
  (select count(*)::integer from cron.job where jobname = 'push-chat' and command like '%group_messages%'),
  1,
  'The push safety net also looks for group messages'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'group_messages_push' and tgrelid = 'public.group_messages'::regclass),
  'New group messages call push-chat straight away'
);

select * from finish();
rollback;
