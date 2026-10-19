-- Saved vendors: saving goes through save_vendor(), to one of the person's
-- wedding events or to Not sure yet; each person sees and removes only their
-- own saves, only published vendors can be saved, and a vendor is saved at
-- most once per event.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Two accounts and three vendors, created as the table owner
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'saver-a@example.com'),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'saver-b@example.com');

insert into public.vendors (id, slug, status, name, city, location) values
  ('20000000-0000-4000-8000-000000000001', 'saves-dhol', 'published', 'Saves Dhol',
    'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('20000000-0000-4000-8000-000000000002', 'saves-dj', 'published', 'Saves DJ',
    'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('20000000-0000-4000-8000-000000000003', 'saves-draft', 'draft', 'Saves Draft',
    'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');

-- Logged out ----------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select * from public.saved_vendors $$,
  '42501', null,
  'Logged-out users cannot read saves'
);

select throws_ok(
  $$ select public.save_vendor('20000000-0000-4000-8000-000000000001', 'jaago') $$,
  '42501', null,
  'Logged-out users cannot save (the app asks them to sign in first)'
);

reset role;

-- Person A, whose wedding is having a jaago ------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

select public.create_wedding(p_events => array['jaago']);

select is(
  public.save_vendor('20000000-0000-4000-8000-000000000001', 'jaago'),
  'jaago',
  'A person can save a vendor for one of their wedding''s events'
);

select ok(
  (select s.user_id = 'a0000000-0000-4000-8000-00000000000a'
     and we.event_slug = 'jaago'
     and s.wedding_id = we.wedding_id
   from public.saved_vendors s
   join public.wedding_events we on we.id = s.wedding_event_id
   where s.vendor_id = '20000000-0000-4000-8000-000000000001'),
  'The save is theirs, on their wedding''s jaago'
);

select is(
  public.save_vendor('20000000-0000-4000-8000-000000000001', 'baraat'),
  'baraat',
  'The same vendor can be saved for another event'
);

select ok(
  exists (select 1 from public.wedding_events where event_slug = 'baraat'),
  'Saving for an event the plan doesn''t have yet adds it to the plan (they can edit it)'
);

select is(
  public.save_vendor('20000000-0000-4000-8000-000000000002'),
  null::text,
  'A vendor can be saved without an event ("Not sure yet")'
);

select public.save_vendor('20000000-0000-4000-8000-000000000001', 'jaago');
select public.save_vendor('20000000-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from public.saved_vendors),
  3,
  'Saving the same vendor for the same event again is harmless, with or without an event'
);

select throws_ok(
  $$ select public.save_vendor('20000000-0000-4000-8000-000000000003', 'jaago') $$,
  'P0002', 'vendor_not_found',
  'An unpublished vendor cannot be saved'
);

select throws_ok(
  $$ insert into public.saved_vendors (user_id, vendor_id)
     values ('b0000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'Nobody writes saves directly, so nobody can save into someone else''s list'
);

-- Person B, with no wedding ----------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "b0000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);

select is(
  public.save_vendor('20000000-0000-4000-8000-000000000001', 'jaago'),
  null::text,
  'Without a wedding there are no events to save to, so it''s Not sure yet'
);

select is(
  (select count(*)::int from public.saved_vendors),
  1,
  'Person B sees only their own save'
);

select is_empty(
  $$ delete from public.saved_vendors
     where user_id = 'a0000000-0000-4000-8000-00000000000a' returning id $$,
  'Person B cannot remove person A''s saves'
);

-- Back to person A -------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

select results_eq(
  $$ delete from public.saved_vendors s
     using public.wedding_events we
     where we.id = s.wedding_event_id and we.event_slug = 'baraat'
     returning s.vendor_id $$,
  array['20000000-0000-4000-8000-000000000001'::uuid],
  'A person can remove one of their saves'
);

select throws_ok(
  $$ update public.saved_vendors set wedding_event_id = null $$,
  '42501', null,
  'Saves are not edited in place (remove and save again)'
);

-- The DJ is also saved for the jaago, then the jaago leaves the plan
select public.save_vendor('20000000-0000-4000-8000-000000000002', 'jaago');
delete from public.wedding_events where event_slug = 'jaago';

select results_eq(
  $$ select vendor_id from public.saved_vendors where wedding_event_id is null order by vendor_id $$,
  array['20000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid],
  'Removing an event moves its saves to Not sure yet, once per vendor'
);

select is(
  (select count(*)::int from public.saved_vendors),
  2,
  'A save already in Not sure yet wins over the moved one'
);

reset role;

delete from auth.users where id = 'a0000000-0000-4000-8000-00000000000a';

select is(
  (select count(*)::int from public.saved_vendors
   where user_id = 'a0000000-0000-4000-8000-00000000000a'),
  0,
  'Deleting the account deletes their saves'
);

select * from finish();
rollback;
