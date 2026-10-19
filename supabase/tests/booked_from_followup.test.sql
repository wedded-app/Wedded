-- "Yes, we booked them" fills in the family's plan, and booked_by counts it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email)
select ('a4000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'bf' || n || '@example.com'
from generate_series(1, 6) as n;

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('b4000000-0000-4000-8000-000000000001', 'bf-hall', 'published', 'Bf Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('b4000000-0000-4000-8000-000000000002', 'bf-other-hall', 'published', 'Bf Other Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_categories (vendor_id, category_slug, position) values
  ('b4000000-0000-4000-8000-000000000001', 'banquet-hall', 1),
  ('b4000000-0000-4000-8000-000000000002', 'banquet-hall', 1);

-- Six families, each with a plan having the reception, each asking the hall
create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user(('a4000000-0000-4000-8000-00000000000' || n)::uuid),
       public.create_wedding(p_events => array['reception', 'jaago'])
from generate_series(1, 6) as n;
reset role;

insert into public.inquiries (id, user_id, vendor_id, guest_band, city_slug, message, preferred_contact,
  sender_name, sender_phone, channel, status, sent_at)
select ('a4100000-0000-4000-8000-00000000000' || n)::uuid, ('a4000000-0000-4000-8000-00000000000' || n)::uuid,
  'b4000000-0000-4000-8000-000000000001',
  '250_500', 'yuba-city', 'Price?', 'call', 'Family ' || n, '+15305550400', 'email', 'sent', now() - interval '3 days'
from generate_series(1, 6) as n;
insert into public.inquiry_events (inquiry_id, event_slug)
select ('a4100000-0000-4000-8000-00000000000' || n)::uuid, case when n = 6 then 'mehndi' else 'reception' end
from generate_series(1, 6) as n;

-- Each family's bookings, by event and vendor type
create view pg_temp.plan_bookings as
select m.user_id, we.event_slug, s.category_slug, b.vendor_id, b.inquiry_id
from public.wedding_members m
join public.wedding_events we on we.wedding_id = m.wedding_id
join public.wedding_slots s on s.wedding_event_id = we.id
join public.bookings b on b.slot_id = s.id;

-- Family 2 already booked another hall for the reception
select private.book_slot(we.id, 'banquet-hall', 'b4000000-0000-4000-8000-000000000002', null, null, false)
from public.wedding_members m
join public.wedding_events we on we.wedding_id = m.wedding_id and we.event_slug = 'reception'
where m.user_id = 'a4000000-0000-4000-8000-000000000002';

set local role authenticated;
select pg_temp.as_user('a4000000-0000-4000-8000-000000000001');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000001';
reset role;

select is(
  (select vendor_id from pg_temp.plan_bookings
   where user_id = 'a4000000-0000-4000-8000-000000000001' and event_slug = 'reception' and category_slug = 'banquet-hall'),
  'b4000000-0000-4000-8000-000000000001'::uuid,
  'Answering "booked" books the vendor in the family''s plan for that event and the vendor''s main category'
);
select ok(
  (select inquiry_id is not null from pg_temp.plan_bookings
   where user_id = 'a4000000-0000-4000-8000-000000000001' and event_slug = 'reception'),
  'and the booking remembers the inquiry it came from'
);

set local role authenticated;
select pg_temp.as_user('a4000000-0000-4000-8000-000000000002');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000002';
select pg_temp.as_user('a4000000-0000-4000-8000-000000000003');
update public.inquiries set reply_answer = 'deciding' where user_id = 'a4000000-0000-4000-8000-000000000003';
select pg_temp.as_user('a4000000-0000-4000-8000-000000000006');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000006';
reset role;

select is(
  (select vendor_id from pg_temp.plan_bookings
   where user_id = 'a4000000-0000-4000-8000-000000000002' and event_slug = 'reception'),
  'b4000000-0000-4000-8000-000000000002'::uuid,
  'A vendor the family already named is never replaced'
);
select is(
  (select count(*)::int from pg_temp.plan_bookings where user_id = 'a4000000-0000-4000-8000-000000000003'),
  0,
  '"Still deciding" books nothing'
);
select is(
  (select count(*)::int from pg_temp.plan_bookings where user_id = 'a4000000-0000-4000-8000-000000000006'),
  0,
  'An inquiry for an event not in the plan books nothing'
);

set local role anon;
select is(
  (select booked_by from public.vendor_public_stats('b4000000-0000-4000-8000-000000000001')),
  null,
  'Fewer than 5 weddings booking shows nothing'
);
reset role;

-- Families 3, 4 and 5 book too (3 changes their mind from "deciding")
update public.inquiries set reply_answer = null where user_id = 'a4000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.as_user('a4000000-0000-4000-8000-000000000003');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000003';
select pg_temp.as_user('a4000000-0000-4000-8000-000000000004');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000004';
select pg_temp.as_user('a4000000-0000-4000-8000-000000000005');
update public.inquiries set reply_answer = 'booked' where user_id = 'a4000000-0000-4000-8000-000000000005';
reset role;
-- Family 6 books it by hand in their plan's jaago
select private.book_slot(we.id, 'banquet-hall', 'b4000000-0000-4000-8000-000000000001', null, null, false)
from public.wedding_members m
join public.wedding_events we on we.wedding_id = m.wedding_id and we.event_slug = 'jaago'
where m.user_id = 'a4000000-0000-4000-8000-000000000006';

set local role anon;
select is(
  (select booked_by from public.vendor_public_stats('b4000000-0000-4000-8000-000000000001')),
  5,
  'Five weddings booking shows "booked by 5"'
);
reset role;

select * from finish();
rollback;
