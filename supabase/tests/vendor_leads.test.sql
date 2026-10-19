-- Vendor leads: anyone can add one, nobody can read them through the API,
-- and claims must point at a published listing.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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
  $$ insert into public.vendor_leads (kind, vendor_id, business_name, contact_name, city, phone)
     values ('claim', '60000000-0000-4000-8000-000000000001', 'Lead Published', 'Owner', 'Yuba City', '+15305550199') $$,
  'A published listing can be claimed'
);

select throws_ok(
  $$ insert into public.vendor_leads (kind, vendor_id, business_name, contact_name, city, phone)
     values ('claim', '60000000-0000-4000-8000-000000000002', 'Lead Draft', 'Owner', 'Yuba City', '+15305550199') $$,
  '42501', null, 'An unpublished listing cannot be claimed'
);

select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone, stage)
     values ('Sneaky', 'Someone', 'Tracy', '+12095550199', 'listed') $$,
  '42501', null, 'The app cannot set a lead''s stage'
);
select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone, submitted_by)
     values ('Sneaky', 'Someone', 'Tracy', '+12095550199', '60000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'or say someone else sent it'
);

select throws_ok(
  $$ select * from public.vendor_leads $$,
  '42501', null, 'Logged-out users cannot read leads'
);

reset role;
insert into auth.users (id, instance_id, aud, role, email) values
  ('61000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lead-sender@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "61000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

select throws_ok(
  $$ select phone from public.vendor_leads $$,
  '42501', null, 'Signed-in users cannot read leads either'
);
insert into public.vendor_leads (business_name, contact_name, city, phone)
values ('Signed In Crew', 'Bal', 'Tracy', '+12095550188');

reset role;
select results_eq(
  $$ select kind, stage, submitted_by from public.vendor_leads where business_name = 'Signed In Crew' $$,
  $$ values ('signup'::text, 'new'::text, '61000000-0000-4000-8000-00000000000a'::uuid) $$,
  'A sign-up starts new and remembers who sent it when they were signed in'
);

select throws_ok(
  $$ insert into public.vendor_leads (business_name, contact_name, city, phone)
     values ('Bad Phone', 'Someone', 'Tracy', '555-0199') $$,
  '23514', null, 'Phone numbers must be E.164'
);

select * from finish();
rollback;
