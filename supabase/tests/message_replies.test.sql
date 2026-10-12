-- Swipe to reply (C5d): a message can quote an earlier one in the same
-- conversation, from either side, and losing the quoted message never loses
-- the reply. The C2 rules still hold with a reply attached.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aa100000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reply-family@example.com'),
  ('aa100000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reply-vendor@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('aa100000-0000-4000-8000-00000000000f', 'Harjit Kaur', 'Yuba City', '+15305550801');
insert into public.vendors (id, slug, status, name, city, location) values
  ('ba100000-0000-4000-8000-000000000001', 'reply-hall', 'published', 'Reply Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('ba100000-0000-4000-8000-000000000002', 'reply-other', 'published', 'Reply Other', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('ba100000-0000-4000-8000-000000000001', 'aa100000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated;

-- The family asks two halls; the first one replies to their question --------------------------

set local role authenticated;
select pg_temp.as_user('aa100000-0000-4000-8000-00000000000f');
insert into pg_temp.ids select 'convo', public.start_conversation('ba100000-0000-4000-8000-000000000001')::text;
insert into pg_temp.ids select 'other', public.start_conversation('ba100000-0000-4000-8000-000000000002')::text;
insert into pg_temp.ids select 'question',
  public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Is June 12 open?')::text;
insert into pg_temp.ids select 'elsewhere',
  public.send_message((select value::uuid from pg_temp.ids where name = 'other'), 'text', 'Hello')::text;

select pg_temp.as_user('aa100000-0000-4000-8000-00000000000e');
insert into pg_temp.ids select 'answer',
  public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Yes, it is!', '{}',
    (select value::uuid from pg_temp.ids where name = 'question'))::text;
select is(
  (select reply_to::text from public.messages where id = (select value::uuid from pg_temp.ids where name = 'answer')),
  (select value from pg_temp.ids where name = 'question'),
  'The vendor replies to the family''s question, quoting it'
);

select pg_temp.as_user('aa100000-0000-4000-8000-00000000000f');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Great, what does it cost?', '{}',
       (select value::uuid from pg_temp.ids where name = 'answer')) $$,
  'and the family replies to the answer'
);
select is(
  (select reply_to from public.messages
   where id = (select value::uuid from pg_temp.ids where name = 'question')),
  null,
  'A message sent without a reply quotes nothing'
);

-- Only messages from the same conversation ------------------------------------------------------

select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'About that', '{}',
       (select value::uuid from pg_temp.ids where name = 'elsewhere')) $$,
  '22023', 'invalid_reply',
  'A reply can''t quote a message from another conversation'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'About that', '{}',
       gen_random_uuid()) $$,
  '22023', 'invalid_reply',
  'or one that doesn''t exist'
);

reset role;
select throws_ok(
  format(
    $$ insert into public.messages (conversation_id, sender_role, kind, body, reply_to)
       values (%L, 'family', 'text', 'Sneaky', %L) $$,
    (select value from pg_temp.ids where name = 'convo'),
    (select value from pg_temp.ids where name = 'elsewhere')),
  '23503', null,
  'The table itself refuses a quote from another conversation'
);

-- The quoted message goes; the reply stays ------------------------------------------------------

delete from public.messages where id = (select value::uuid from pg_temp.ids where name = 'question');
select is(
  (select reply_to from public.messages where id = (select value::uuid from pg_temp.ids where name = 'answer')),
  null,
  'Deleting a quoted message keeps the reply and drops the quote'
);

-- C2 still applies with a reply attached ----------------------------------------------------------

select pg_temp.as_user('aa100000-0000-4000-8000-00000000000e');
set local role authenticated;
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'other'), 'text', 'Book us!', '{}',
       (select value::uuid from pg_temp.ids where name = 'elsewhere')) $$,
  '42501', 'not_allowed',
  'A reply doesn''t let anyone write in a conversation that isn''t theirs'
);

select * from finish();
rollback;
