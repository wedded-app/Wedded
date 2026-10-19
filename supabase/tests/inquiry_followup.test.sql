-- "Did they get back to you?": sending an inquiry schedules the question two
-- days on; families answer only their own, only the answer, and the database
-- stamps the time.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'followup-a@example.com'),
  ('b1000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'followup-b@example.com');

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('41000000-0000-4000-8000-000000000001', 'followup-vendor', 'published', 'Followup Vendor', 'yuba-city',
    'SRID=4326;POINT(-121.6169 39.1404)');

insert into public.inquiries (id, user_id, vendor_id, guest_band, venue_text, message, preferred_contact,
  sender_name, sender_phone, channel, status, sent_at) values
  ('51000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a',
    '41000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price please?', 'call',
    'Asker A', '+15305550111', 'email', 'sent', now() - interval '3 days'),
  ('51000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a',
    '41000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price please?', 'call',
    'Asker A', '+15305550111', 'email', 'sending', null),
  ('51000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-00000000000b',
    '41000000-0000-4000-8000-000000000001', '100_250', 'Yuba City', 'Price please?', 'call',
    'Asker B', '+15305550112', 'email', 'sent', now() - interval '3 days');

select is(
  (select asked_at from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000001'),
  (select sent_at + interval '2 days' from public.inquiries where id = '51000000-0000-4000-8000-000000000001'),
  'A sent inquiry gets its question, asked two days after it went out'
);
select is(
  (select count(*)::int from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000002'),
  0,
  'An inquiry still sending has none'
);
update public.inquiries set status = 'sent', sent_at = now() where id = '51000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000002'),
  1,
  'and gets it once it sends'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a1000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

update public.followups set answer = 'deciding' where inquiry_id = '51000000-0000-4000-8000-000000000001';
select is(
  (select answer from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000001'),
  'deciding',
  'A family can answer the follow-up on their own inquiry'
);
select ok(
  (select answered_at is not null from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000001'),
  'The database stamps when they answered'
);

update public.followups set answer = 'booked' where inquiry_id = '51000000-0000-4000-8000-000000000001';
select is(
  (select answer from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000001'),
  'booked',
  'They can change their answer later (still deciding, then booked)'
);

select throws_ok(
  $$ update public.followups set answer = 'maybe' where inquiry_id = '51000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'Only the three answers are allowed'
);

select throws_ok(
  $$ update public.followups set asked_at = now() where inquiry_id = '51000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'Families cannot change when it is asked'
);

select throws_ok(
  $$ update public.followups set answered_at = now() - interval '1 year' where inquiry_id = '51000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'Families cannot backdate the answer time'
);

update public.followups set answer = 'no_reply' where inquiry_id = '51000000-0000-4000-8000-000000000003';
reset role;
select is(
  (select answer from public.followups where inquiry_id = '51000000-0000-4000-8000-000000000003'),
  null,
  'Nobody can answer someone else''s inquiry'
);

set local role anon;
select throws_ok(
  $$ update public.followups set answer = 'booked' where inquiry_id = '51000000-0000-4000-8000-000000000003' $$,
  '42501', null,
  'Logged-out users cannot answer anything'
);

select * from finish();
rollback;
