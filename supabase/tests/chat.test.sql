-- Chat: who reads what, what each side can send, unread counts and read
-- markers, inquiries starting conversations, account deletion, chat photos.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a6000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-family@example.com'),
  ('a6000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-vendor@example.com'),
  ('a6000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chat-stranger@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a6000000-0000-4000-8000-00000000000f', 'Harjit Kaur', 'Yuba City', '+15305550601'),
  ('a6000000-0000-4000-8000-00000000000d', 'Dev Stranger', 'Fremont', '+15105550602');

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b6000000-0000-4000-8000-000000000001', 'chat-hall', 'published', 'Chat Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('b6000000-0000-4000-8000-000000000002', 'chat-other', 'published', 'Chat Other', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('b6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-00000000000e');
insert into public.vendor_menus (id, vendor_id, name) values
  ('c6000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'Gold'),
  ('c6000000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000002', 'Not theirs');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated;

-- The family starts a chat -------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000f');
insert into pg_temp.ids select 'convo', public.start_conversation('b6000000-0000-4000-8000-000000000001')::text;
select is(
  public.start_conversation('b6000000-0000-4000-8000-000000000001')::text,
  (select value from pg_temp.ids where name = 'convo'),
  'One conversation per family and vendor'
);
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Sat Sri Akal, is June 12 open?') $$,
  'The family sends a message'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'quote', null, '{"amount": 5000}') $$,
  '22023', 'invalid_kind',
  'Families can''t send quotes'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', '   ') $$,
  '22023', 'empty_message',
  'An empty message is refused'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_role, body)
     values ((select value::uuid from pg_temp.ids where name = 'convo'), 'vendor', 'Fake') $$,
  '42501', null,
  'Nobody writes messages directly'
);

-- The vendor replies -----------------------------------------------------------------------

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000e');
select results_eq(
  $$ select side, family_name, unread_count, last_body from public.my_conversations() $$,
  $$ values ('vendor'::text, 'Harjit K.'::text, 1, 'Sat Sri Akal, is June 12 open?'::text) $$,
  'The vendor''s inbox shows the family''s short name, the message and 1 unread'
);
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'quote', 'For 300 guests',
       '{"amount": 16500, "unit": "event", "eventSlug": "reception"}') $$,
  'The vendor sends a quote'
);
select lives_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'menu', null,
       '{"menuId": "c6000000-0000-4000-8000-000000000001"}') $$,
  'and one of their menus'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'menu', null,
       '{"menuId": "c6000000-0000-4000-8000-000000000002"}') $$,
  '22023', 'invalid_menu',
  'but not another vendor''s menu'
);
select is(
  (select unread_count from public.my_conversations()),
  0,
  'Replying marks it read for the vendor'
);

-- Unread and read markers for the family ------------------------------------------------------

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000f');
select results_eq(
  $$ select side, vendor_slug, unread_count, last_kind from public.my_conversations() $$,
  $$ values ('family'::text, 'chat-hall'::text, 2, 'menu'::text) $$,
  'The family sees 2 unread from the vendor'
);
select public.mark_conversation_read((select value::uuid from pg_temp.ids where name = 'convo'));
select is(
  (select unread_count from public.my_conversations()),
  0,
  'Opening the chat marks it read'
);
select ok(
  (select other_read_at is not null from public.my_conversations()),
  'and the family can see when the vendor last read it ("Seen")'
);

-- Strangers -------------------------------------------------------------------------------------

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000d');
select is(
  (select count(*)::int from public.messages) + (select count(*)::int from public.conversations)
    + (select count(*)::int from public.my_conversations()),
  0,
  'Nobody else sees the conversation or its messages'
);
select throws_ok(
  $$ select public.send_message((select value::uuid from pg_temp.ids where name = 'convo'), 'text', 'Hi') $$,
  '42501', 'not_allowed',
  'or can write in it'
);

-- Photos ------------------------------------------------------------------------------------------

select pg_temp.as_user('a6000000-0000-4000-8000-00000000000f');
select ok(
  private.can_use_chat_object((select value from pg_temp.ids where name = 'convo') || '/hall.jpg'),
  'The family can upload a photo into their conversation''s folder'
);
select pg_temp.as_user('a6000000-0000-4000-8000-00000000000d');
select ok(
  not private.can_use_chat_object((select value from pg_temp.ids where name = 'convo') || '/hall.jpg')
    and not private.can_use_chat_object('not-a-uuid/hall.jpg'),
  'Nobody else can'
);
reset role;

-- An inquiry continues the conversation ----------------------------------------------------------

insert into public.inquiries (id, user_id, vendor_id, event_date, guest_band, city_slug, message,
  preferred_contact, sender_name, sender_phone, channel, status)
values ('a6100000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-00000000000f', 'b6000000-0000-4000-8000-000000000001',
  '2027-06-12', '250_500', 'yuba-city', 'Price for a reception?', 'call', 'Harjit Kaur', '+15305550601', 'email', 'sent');
insert into public.inquiry_events (inquiry_id, event_slug) values ('a6100000-0000-4000-8000-000000000001', 'reception');

select results_eq(
  $$ select kind, body, data ->> 'guestBand', data ->> 'location', data -> 'eventSlugs' from public.messages
     where conversation_id = (select value::uuid from pg_temp.ids where name = 'convo')
     order by created_at desc limit 1 $$,
  $$ values ('booking'::text, 'Price for a reception?'::text, '250_500'::text, 'Yuba City'::text, '["reception"]'::jsonb) $$,
  'An inquiry adds its booking details to the same conversation, its events filled in as they''re added'
);

insert into public.inquiries (user_id, vendor_id, guest_band, city_slug, message, preferred_contact,
  sender_name, sender_phone, channel, status)
values ('a6000000-0000-4000-8000-00000000000f', 'b6000000-0000-4000-8000-000000000002', '100_250', 'yuba-city',
  'Hello', 'text', 'Harjit Kaur', '+15305550601', 'email', 'sent');
select is(
  (select count(*)::int from public.conversations where family_user_id = 'a6000000-0000-4000-8000-00000000000f'),
  2,
  'An inquiry to a new vendor starts a new conversation'
);

-- Account deletion ---------------------------------------------------------------------------------

delete from auth.users where id = 'a6000000-0000-4000-8000-00000000000f';
select is(
  (select family_name from public.conversations where id = (select value::uuid from pg_temp.ids where name = 'convo')),
  null,
  'Deleting the family''s account removes their name from the vendor''s copy'
);

select * from finish();
rollback;
