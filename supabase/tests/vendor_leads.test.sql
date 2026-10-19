-- Vendor leads: anyone can add one, nobody can read them through the API,
-- and claims must point at a published listing.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('60000000-0000-4000-8000-000000000001', 'lead-published', 'published', 'Lead Published', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)'),
  ('60000000-0000-4000-8000-000000000002', 'lead-draft', 'draft', 'Lead Draft', 'yuba-city', 'SRID=4326;POINT(-121.6 39.1)');

set local role anon;

select lives_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, category, city, phone)
     values ('Sukhi Dhol Crew', 'Sukhi', 'Dhol player', 'Tracy', '+12095550199') $$,
  'Logged-out vendors can sign up'
);

select lives_ok(
  $$ insert into public.vendor_leads (kind, claimed_vendor_id, business_name, contact_name, city, phone)
     values ('claim', '60000000-0000-4000-8000-000000000001', 'Lead Published', 'Owner', 'Yuba City', '+15305550199') $$,
  'A published listing can be claimed'
);

select throws_ok(
  $$ insert into public.vendor_leads (kind, claimed_vendor_id, business_name, contact_name, city, phone)
     values ('claim', '60000000-0000-4000-8000-000000000002', 'Lead Draft', 'Owner', 'Yuba City', '+15305550199') $$,
  '42501', null, 'An unpublished listing cannot be claimed'
);

select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone, status)
     values ('Sneaky', 'Someone', 'Tracy', '+12095550199', 'listed') $$,
  '42501', null, 'The app cannot set a lead''s status'
);

select throws_ok(
  $$ select * from public.vendor_leads $$,
  '42501', null, 'Logged-out users cannot read leads'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select phone from public.vendor_leads $$,
  '42501', null, 'Signed-in users cannot read leads either'
);

reset role;

select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone)
     values ('Bad Phone', 'Someone', 'Tracy', '555-0199') $$,
  '23514', null, 'Phone numbers must be E.164'
);

select * from finish();
rollback;
