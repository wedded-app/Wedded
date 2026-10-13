-- Vendors edit their own listing: their people change the editable fields,
-- every value is checked, and the rest stays with the founders.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a1200000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edit-owner@example.com'),
  ('a1200000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'edit-stranger@example.com');
insert into public.vendors (id, slug, status, name, city, location, tagline, languages) values
  ('b1200000-0000-4000-8000-000000000001', 'edit-dhol', 'draft', 'Edit Dhol', 'Yuba City',
   'SRID=4326;POINT(-121.6169 39.1404)', 'Old tagline', array['pa']);
insert into public.vendor_members (vendor_id, user_id) values
  ('b1200000-0000-4000-8000-000000000001', 'a1200000-0000-4000-8000-00000000000e');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('a1200000-0000-4000-8000-00000000000e');

select is(
  (select public.my_listing('b1200000-0000-4000-8000-000000000001') ->> 'tagline'),
  'Old tagline',
  'A vendor reads their own listing, even as a draft'
);

select is(
  (select public.update_my_listing('b1200000-0000-4000-8000-000000000001', jsonb_build_object(
     'tagline', '  Dhol for every baraat  ',
     'bio', 'Three generations of dhol players.',
     'bioPa', 'ਤਿੰਨ ਪੀੜ੍ਹੀਆਂ ਤੋਂ ਢੋਲੀ।',
     'priceDisplay', 'starting_at',
     'priceFrom', 450,
     'priceUnit', 'event',
     'whatsappPhone', '+15305550111',
     'instagramHandle', '@edit.dhol',
     'websiteUrl', 'editdhol.com',
     'languages', jsonb_build_array('pa', 'en', 'hi'),
     'serviceRadiusMiles', 50,
     'willTravel', true
   )) - array['name', 'slug', 'status', 'city', 'taglinePa', 'priceTo', 'priceNote', 'callPhone',
              'textPhone', 'preferredContact', 'yearsInBusiness', 'teamSize', 'travelNote', 'officeHours']),
  jsonb_build_object(
    'tagline', 'Dhol for every baraat',
    'bio', 'Three generations of dhol players.',
    'bioPa', 'ਤਿੰਨ ਪੀੜ੍ਹੀਆਂ ਤੋਂ ਢੋਲੀ।',
    'priceDisplay', 'starting_at',
    'priceFrom', 450,
    'priceUnit', 'event',
    'whatsappPhone', '+15305550111',
    'instagramHandle', 'edit.dhol',
    'websiteUrl', 'https://editdhol.com',
    'languages', jsonb_build_array('pa', 'en', 'hi'),
    'serviceRadiusMiles', 50,
    'willTravel', true
  ),
  'Saves the changes, tidied (trimmed, no @, https:// added), and returns the listing'
);

select lives_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"bio": "Updated."}') $$,
  'Only what is sent changes'
);
select is(
  (select public.my_listing('b1200000-0000-4000-8000-000000000001') ->> 'tagline'),
  'Dhol for every baraat',
  'Fields not sent stay as they were'
);
select is(
  (select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"instagramHandle": null}')
     -> 'instagramHandle'),
  'null'::jsonb,
  'Null clears a field'
);

select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"name": "Best Dhol Ever"}') $$,
  '42501', 'not_editable:name',
  'The name stays with the founders'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"status": "published"}') $$,
  '42501', 'not_editable:status',
  'and so does publishing'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"callPhone": "5305550111"}') $$,
  '22023', 'invalid_field:callPhone',
  'Phone numbers must be complete'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001',
       jsonb_build_object('tagline', repeat('x', 121))) $$,
  '22023', 'invalid_field:tagline',
  'Taglines up to 120 characters'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001',
       '{"priceDisplay": "range", "priceFrom": 500, "priceTo": 300, "priceUnit": "event"}') $$,
  '22023', 'invalid_field:priceDisplay',
  'A price range must go up'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"languages": []}') $$,
  '22023', 'invalid_field:languages',
  'At least one language'
);
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"teamSize": "lots"}') $$,
  '22023', 'invalid_field:number',
  'Numbers must be numbers'
);

select pg_temp.as_user('a1200000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.update_my_listing('b1200000-0000-4000-8000-000000000001', '{"bio": "Hacked"}') $$,
  '42501', 'not_allowed',
  'Someone else can''t change a vendor''s listing'
);
select throws_ok(
  $$ select public.my_listing('b1200000-0000-4000-8000-000000000001') $$,
  '42501', 'not_allowed',
  'or read a draft one'
);
reset role;

select * from finish();
rollback;
