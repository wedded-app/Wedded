-- Reactions on chat messages (C5c): both sides react, one reaction each per
-- message (replaced or taken back), nobody else sees or adds them.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aa000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'react-family@example.com'),
  ('aa000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'react-vendor@example.com'),
  ('aa000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'react-stranger@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('aa000000-0000-4000-8000-00000000000f', 'Harjit Kaur', 'Yuba City', '+15305550801'),
  ('aa000000-0000-4000-8000-00000000000d', 'Dev Stranger', 'Fremont', '+15105550802');
insert into public.vendors (id, slug, status, name, city, location) values
  ('ba000000-0000-4000-8000-000000000001', 'react-hall', 'published', 'React Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('ba000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated;

set local role authenticated;
select pg_temp.as_user('aa000000-0000-4000-8000-00000000000f');
insert into pg_temp.ids select 'convo', public.start_conversation('ba000000-0000-4000-8000-000000000001')::text;
insert into pg_temp.ids
select 'ask', public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Is June 12 open?')::text;
select pg_temp.as_user('aa000000-0000-4000-8000-00000000000e');
insert into pg_temp.ids
select 'answer', public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Yes, it is!')::text;

-- Reacting -----------------------------------------------------------------------------------

select pg_temp.as_user('aa000000-0000-4000-8000-00000000000f');
select lives_ok(
  $$ select public.react_to_message((select value::uuid from pg_temp.ids where name = 'answer'), 'heart') $$,
  'A family reacts to the vendor''s answer'
);
select pg_temp.as_user('aa000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.react_to_message((select value::uuid from pg_temp.ids where name = 'ask'), 'thumbs_up') $$,
  'and the vendor to the family''s question'
);
select results_eq(
  $$ select reaction from public.message_reactions
     where message_id = (select value::uuid from pg_temp.ids where name = 'answer') $$,
  $$ values ('heart'::text) $$,
  'Both sides see the reactions'
);

select pg_temp.as_user('aa000000-0000-4000-8000-00000000000f');
select public.react_to_message((select value::uuid from pg_temp.ids where name = 'answer'), 'pray');
select results_eq(
  $$ select reaction from public.message_reactions
     where message_id = (select value::uuid from pg_temp.ids where name = 'answer') $$,
  $$ values ('pray'::text) $$,
  'Picking another emoji replaces your reaction: one each per message'
);
select public.react_to_message((select value::uuid from pg_temp.ids where name = 'answer'), null);
select is_empty(
  $$ select 1 from public.message_reactions
     where message_id = (select value::uuid from pg_temp.ids where name = 'answer') $$,
  'and you can take it back'
);
select throws_ok(
  $$ select public.react_to_message((select value::uuid from pg_temp.ids where name = 'answer'), 'fire') $$,
  '22023', 'invalid_reaction',
  'Only the six reactions'
);
select throws_ok(
  $$ insert into public.message_reactions (message_id, conversation_id, user_id, reaction)
     values ((select value::uuid from pg_temp.ids where name = 'answer'),
       (select value::uuid from pg_temp.ids where name = 'convo'),
       'aa000000-0000-4000-8000-00000000000f', 'heart') $$,
  '42501', null,
  'Reactions are only written through react_to_message'
);

-- Strangers ------------------------------------------------------------------------------------

select pg_temp.as_user('aa000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.react_to_message((select value::uuid from pg_temp.ids where name = 'ask'), 'laugh') $$,
  '42501', 'not_allowed',
  'Nobody outside the conversation reacts'
);
select is_empty(
  $$ select 1 from public.message_reactions $$,
  'or sees its reactions'
);

select * from finish();
rollback;
