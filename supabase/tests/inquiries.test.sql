-- Inquiries: every rule in create_inquiry(), what the app's roles can and
-- can't do, and scrubbing the sender when an account is deleted.

begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- Accounts (A, C and D have profiles; B doesn't) and vendors -----------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asker-a@example.com'),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asker-b@example.com'),
  ('c0000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asker-c@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'asker-d@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Asker A', 'Yuba City', '+15305550111'),
  ('c0000000-0000-4000-8000-00000000000c', 'Asker C', 'Fremont', '+15105550112'),
  ('d0000000-0000-4000-8000-00000000000d', 'Asker D', 'Tracy', '+12095550113');

-- A's wedding is having a jaago
insert into public.weddings (id, created_by)
values ('aa000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
insert into public.wedding_members (wedding_id, user_id, role)
values ('aa000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'owner');
insert into public.wedding_events (wedding_id, event_slug)
values ('aa000000-0000-4000-8000-00000000000a', 'jaago');

insert into public.vendors (id, slug, status, name, base_city_slug, location)
select ('40000000-0000-4000-8000-00000000000' || n)::uuid, 'ask-vendor-' || n,
  case when n = 3 then 'draft' else 'published' end,
  'Ask Vendor ' || n, 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'
from generate_series(1, 7) as n;

-- Vendor 1 reads email; vendor 2 has none (relay); the rest read email
insert into public.vendor_private (vendor_id, email, checks_email)
select ('40000000-0000-4000-8000-00000000000' || n)::uuid, 'vendor' || n || '@example.com', true
from generate_series(1, 7) as n where n <> 2;

-- A short way to ask, as the Edge Function does
create function pg_temp.ask(
  who uuid, vendor_n integer, events text[] default array['jaago'],
  on_date date default current_date + 30, again boolean default false,
  place text default 'Yuba City', answers jsonb default '{}'
) returns jsonb language sql as $$
  select public.create_inquiry(
    p_user_id => who,
    p_vendor_id => ('40000000-0000-4000-8000-00000000000' || vendor_n)::uuid,
    p_event_slugs => events, p_event_date => on_date, p_start_time => null,
    p_guest_band => '100_250', p_location => place, p_message => 'Sat Sri Akal, price please?',
    p_preferred_contact => 'text', p_details => answers,
    p_sender_name => 'Asker', p_sender_phone => '+15305550111', p_sender_email => 'asker@example.com',
    p_send_again => again)
$$;

-- The app can't skip the Edge Function ------------------------------------------------

set local role anon;
select throws_ok($$ select pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1) $$,
  '42501', null, 'Logged-out users cannot call create_inquiry');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
select throws_ok($$ select pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1) $$,
  '42501', null, 'Signed-in users cannot call create_inquiry directly (rate limits live behind the Edge Function)');
select throws_ok(
  $$ insert into public.inquiries (user_id, vendor_id, guest_band, venue_text, message, preferred_contact, sender_name, sender_phone, channel)
     values ('a0000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-000000000001', 'not_sure', 'x', 'x', 'text', 'x', '+15305550111', 'email') $$,
  '42501', null, 'Signed-in users cannot write inquiries directly');
reset role;

-- The rules (as the Edge Function's service role) -------------------------------------

set local role service_role;

select is(pg_temp.ask('b0000000-0000-4000-8000-00000000000b', 1) ->> 'outcome', 'needs_profile',
  'No profile (About you not done): asked to finish it first');
select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 3) ->> 'outcome', 'vendor_not_found',
  'An unpublished vendor cannot be asked');
select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1, array['not-an-event']) ->> 'field', 'eventSlugs',
  'Unknown events are refused');
select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1, on_date => current_date - 2) ->> 'field', 'eventDate',
  'A date in the past is refused');

select results_eq(
  $$ select r ->> 'outcome', r ->> 'status', r ->> 'channel', r ->> 'vendor_email'
     from pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1) as r $$,
  $$ values ('created', 'sending', 'email', 'vendor1@example.com') $$,
  'A valid inquiry is recorded, ready to email the vendor'
);

select ok(
  exists (select 1 from public.saved_vendors s
          join public.wedding_events we on we.id = s.wedding_event_id
          where s.user_id = 'a0000000-0000-4000-8000-00000000000a'
            and s.vendor_id = '40000000-0000-4000-8000-000000000001' and we.event_slug = 'jaago'
            and s.source = 'inquiry'),
  'Asking a vendor saves them under that event of the family''s wedding'
);

select results_eq(
  $$ select i.city_slug, i.venue_text, i.kind, i.date_flex, i.wedding_id is not null, ie.event_slug,
       ie.wedding_event_id is not null
     from public.inquiries i join public.inquiry_events ie on ie.inquiry_id = i.id
     where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000001' $$,
  $$ values ('yuba-city'::text, null::text, 'price_date'::text, 'exact'::text, true, 'jaago'::text, true) $$,
  'The inquiry names a listed city, belongs to the family''s wedding, and its jaago is the wedding''s'
);

select pg_temp.ask('d0000000-0000-4000-8000-00000000000d', 4, array[]::text[], on_date => null,
  place => 'Gill family farm', answers => '{"tour": true, "visit": "weekend",
    "tourSlots": [{"date": "2027-01-16", "part": "morning"}, {"date": "2027-01-17", "part": "evening"}]}');
select results_eq(
  $$ select city_slug, venue_text, kind, date_flex, answers, (select count(*)::int from public.inquiry_events ie where ie.inquiry_id = i.id)
     from public.inquiries i
     where user_id = 'd0000000-0000-4000-8000-00000000000d' and vendor_id = '40000000-0000-4000-8000-000000000004' $$,
  $$ values (null::text, 'Gill family farm'::text, 'tour'::text, 'not_sure'::text, '{"visit": "weekend"}'::jsonb, 0) $$,
  'A place that isn''t a listed city stays as typed; a tour is its kind; no date is not sure; no events is Not sure'
);
select results_eq(
  $$ select ts.rank::int, ts.day, ts.part
     from public.tour_slots ts join public.inquiries i on i.id = ts.inquiry_id
     where i.user_id = 'd0000000-0000-4000-8000-00000000000d' and i.vendor_id = '40000000-0000-4000-8000-000000000004'
     order by ts.rank $$,
  $$ values (1, '2027-01-16'::date, 'morning'::text), (2, '2027-01-17'::date, 'evening'::text) $$,
  'A tour''s visit times become rows, in the family''s order'
);
select is(
  (select m.data -> 'details' from public.messages m join public.inquiries i on i.id = m.inquiry_id
   where i.user_id = 'd0000000-0000-4000-8000-00000000000d' and i.vendor_id = '40000000-0000-4000-8000-000000000004'),
  '{"tour": true, "visit": "weekend", "tourSlots": [{"date": "2027-01-16", "part": "morning"}, {"date": "2027-01-17", "part": "evening"}]}'::jsonb,
  'and the chat card shows them with the answers'
);

select ok(
  (select r ->> 'outcome' = 'duplicate' and r ? 'previous_at'
   from pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1) as r),
  'Asking the same vendor again within 24 hours says when they last asked'
);

select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 1, again => true) ->> 'outcome', 'created',
  '"Send again" goes through');

select results_eq(
  $$ select r ->> 'channel', r ->> 'vendor_email'
     from pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 2, array[]::text[]) as r $$,
  $$ values ('relay', null::text) $$,
  'A vendor without email is relayed through the founders'
);

select ok(
  exists (select 1 from public.saved_vendors
          where user_id = 'a0000000-0000-4000-8000-00000000000a'
            and vendor_id = '40000000-0000-4000-8000-000000000002' and wedding_event_id is null),
  'Asking without an event saves the vendor under Not sure yet'
);

-- The email to vendor 2 failed three days ago; trying again reuses that inquiry (#349)
update public.inquiries set status = 'failed', failure = 'No email provider', created_at = now() - interval '3 days'
where user_id = 'a0000000-0000-4000-8000-00000000000a' and vendor_id = '40000000-0000-4000-8000-000000000002';
update public.messages m set created_at = now() - interval '3 days'
from public.inquiries i
where i.id = m.inquiry_id and i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002';
update public.conversations set last_message_at = now() - interval '3 days'
where family_user_id = 'a0000000-0000-4000-8000-00000000000a' and vendor_id = '40000000-0000-4000-8000-000000000002';
select is(
  (pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 2, array['mehndi']) ->> 'inquiry_id')::uuid,
  (select id from public.inquiries
   where user_id = 'a0000000-0000-4000-8000-00000000000a' and vendor_id = '40000000-0000-4000-8000-000000000002'),
  'A retry after the email failed is the same inquiry, not a second one'
);
select results_eq(
  $$ select i.status, i.failure, private.inquiry_event_slugs(i.id)
     from public.inquiries i
     where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002' $$,
  $$ values ('sending', null::text, array['mehndi']) $$,
  'The retried inquiry goes out again with the new details'
);
select results_eq(
  $$ select count(*)::int, min(m.data ->> 'eventSlugs')
     from public.messages m join public.inquiries i on i.id = m.inquiry_id
     where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002' $$,
  $$ values (1, '["mehndi"]') $$,
  'The vendor''s chat keeps one card, updated to the retry'
);
select results_eq(
  $$ select i.created_at = now(), m.created_at > now() - interval '1 hour', c.last_message_at > now() - interval '1 hour'
     from public.inquiries i
     join public.messages m on m.inquiry_id = i.id
     join public.conversations c on c.id = m.conversation_id
     where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002' $$,
  $$ values (true, true, true) $$,
  'The retry is dated now, and its card and conversation come back to the top'
);

-- The vendor answered the card, then the email failed again: a retry keeps the card above the answer
update public.inquiries set status = 'failed', failure = 'No email provider'
where user_id = 'a0000000-0000-4000-8000-00000000000a' and vendor_id = '40000000-0000-4000-8000-000000000002';
insert into public.messages (conversation_id, sender_role, kind, body, created_at)
select m.conversation_id, 'vendor', 'text', 'Which date works?', clock_timestamp() + interval '1 minute'
from public.messages m join public.inquiries i on i.id = m.inquiry_id
where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002';
create temp table card_before as
select m.created_at from public.messages m join public.inquiries i on i.id = m.inquiry_id
where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002';
select is(
  pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 2, array['mehndi']) ->> 'outcome', 'created',
  'Trying again after the vendor answered still goes out'
);
select is(
  (select m.created_at from public.messages m join public.inquiries i on i.id = m.inquiry_id
   where i.user_id = 'a0000000-0000-4000-8000-00000000000a' and i.vendor_id = '40000000-0000-4000-8000-000000000002'),
  (select created_at from card_before),
  'A card the vendor already answered keeps its place in the chat'
);

-- A has 3 in the last hour; 2 more reach the limit of 5
select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 4) ->> 'outcome', 'created', 'Fourth inquiry this hour is fine');
select is(pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 5) ->> 'outcome', 'created', 'Fifth inquiry this hour is fine');
select results_eq(
  $$ select r ->> 'outcome', r ->> 'limit' from pg_temp.ask('a0000000-0000-4000-8000-00000000000a', 6) as r $$,
  $$ values ('rate_limited', 'hour') $$,
  'The sixth inquiry in an hour is refused'
);

reset role;

-- C already sent 15 today (2 hours ago)
insert into public.inquiries (user_id, vendor_id, guest_band, venue_text, message, preferred_contact,
  sender_name, sender_phone, channel, status, created_at)
select 'c0000000-0000-4000-8000-00000000000c', '40000000-0000-4000-8000-000000000001', 'not_sure',
  'Fremont', 'Earlier', 'call', 'Asker C', '+15105550112', 'email', 'sent', now() - interval '2 hours'
from generate_series(1, 15);

set local role service_role;
select results_eq(
  $$ select r ->> 'outcome', r ->> 'limit' from pg_temp.ask('c0000000-0000-4000-8000-00000000000c', 7) as r $$,
  $$ values ('rate_limited', 'day') $$,
  'The sixteenth inquiry in a day is refused'
);
reset role;

-- The app-wide daily cap has been reached: new inquiries wait in the queue
-- (using the function's own count, so rows left in a local database can't skew it)
update public.app_config
set value = to_jsonb((value #>> '{}')::int - public.inquiry_emails_left_today())
where key = 'inquiry_daily_cap';

set local role service_role;
select is(pg_temp.ask('d0000000-0000-4000-8000-00000000000d', 7) ->> 'status', 'queued',
  'Past the daily cap, inquiries are queued instead of failing');
reset role;

-- Reading ---------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
select is((select count(*)::int from public.inquiries), 5, 'People see their own inquiries (A sent 5)');
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-4000-8000-00000000000d", "role": "authenticated"}', true);
select is((select count(*)::int from public.inquiries), 2, 'and nobody else''s (D sent 2)');
select throws_ok($$ select * from public.app_config $$, '42501', null, 'App settings are not readable through the API');
reset role;

-- Account deletion --------------------------------------------------------------------------

delete from auth.users where id = 'a0000000-0000-4000-8000-00000000000a';

select results_eq(
  $$ select count(*)::int, count(sender_name)::int, count(sender_phone)::int, count(sender_email)::int
     from public.inquiries where message = 'Sat Sri Akal, price please?' and vendor_id in (
       '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
       '40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005')
       and user_id is null $$,
  $$ values (5, 0, 0, 0) $$,
  'Deleting an account keeps the vendors'' inquiry history but scrubs the sender''s details'
);

select * from finish();
rollback;
