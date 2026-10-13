-- No-spam rules (C2): a vendor only replies once the family has written,
-- at most 2 follow-ups once a day passes without a family reply, and a
-- family's number reaches chat only when they share it (from their profile).

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a9000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spam-family@example.com'),
  ('a9000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spam-asker@example.com'),
  ('a9000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spam-vendor@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a9000000-0000-4000-8000-00000000000f', 'Harjit Kaur', 'Yuba City', '+15305550701'),
  ('a9000000-0000-4000-8000-00000000000a', 'Asha Gill', 'Yuba City', '+15305550702');
insert into public.vendors (id, slug, status, name, city, location) values
  ('b9000000-0000-4000-8000-000000000001', 'spam-hall', 'published', 'Spam Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated;

-- A family taps Message but hasn't written yet -------------------------------------------

set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000f');
insert into pg_temp.ids select 'convo', public.start_conversation('b9000000-0000-4000-8000-000000000001')::text;

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Hi! Book us?') $$,
  '42501', 'family_first',
  'A vendor can''t write to a family that hasn''t written to them'
);

-- The family writes, and the vendor answers freely that day -------------------------------

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000f');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Is June 12 open?') $$,
  'The family asks'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Yes it is!');
     select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'quote', null, '{"amount": 5000}');
     select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'That includes the bar.') $$,
  'and the vendor answers, as many messages as they need on the day'
);

-- Days later, no reply: two follow-ups, then wait --------------------------------------------

reset role;
update public.messages set created_at = created_at - interval '3 days'
where conversation_id = (select value::uuid from pg_temp.ids where name = 'convo');
set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Just checking in!') $$,
  'Days later the vendor follows up once'
);
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'June is filling up.') $$,
  'and twice'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Hello??') $$,
  'P0001', 'wait_for_reply',
  'but not a third time without a reply'
);

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000f');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Sorry, busy week!') $$,
  'The family writes back'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'No problem!') $$,
  'and the vendor can answer again'
);

-- Sharing a number ----------------------------------------------------------------------------

select is_empty(
  $$ select 1 from public.messages
     where conversation_id = (select value::uuid from pg_temp.ids where name = 'convo')
       and (body like '%5550701%' or data::text like '%5550701%') $$,
  'Until the family shares it, their number isn''t in the chat'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000f');
insert into pg_temp.ids
select 'phone', public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'phone', 'call me',
  '{"phone": "+19995550000"}')::text;
select results_eq(
  $$ select kind, body, data ->> 'phone' from public.messages
     where id = (select value::uuid from pg_temp.ids where name = 'phone') $$,
  $$ values ('phone'::text, null::text, '+15305550701'::text) $$,
  '"Share my number" shares the number on their profile, never one typed in'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select is(
  (select data ->> 'phone' from public.messages
   where id = (select value::uuid from pg_temp.ids where name = 'phone')),
  '+15305550701',
  'and the vendor sees it'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'phone', null, '{}') $$,
  '22023', 'invalid_kind',
  'Only families share a number'
);

-- An inquiry counts as writing first --------------------------------------------------------

reset role;
insert into public.conversations (id, vendor_id, family_user_id, family_name)
values ('d9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001',
  'a9000000-0000-4000-8000-00000000000a', 'Asha G.');
insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body)
values ('d9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-00000000000a', 'family', 'booking',
  'Price for 300 guests?');
set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message('d9000000-0000-4000-8000-000000000001', 'text', 'Thanks for asking! Here''s our quote.') $$,
  'A vendor replies to an inquiry in chat'
);

select * from finish();
rollback;
