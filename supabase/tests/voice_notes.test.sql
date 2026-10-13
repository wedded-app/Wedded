-- Voice notes: a recording in the conversation's own folder, up to 5 minutes,
-- from either side; the chat bucket takes audio.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('af000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voice-family@example.com'),
  ('af000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voice-vendor@example.com');
insert into public.vendors (id, slug, status, name, city, location) values
  ('bf000000-0000-4000-8000-000000000001', 'voice-dhol', 'published', 'Voice Dhol', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('bf000000-0000-4000-8000-000000000001', 'af000000-0000-4000-8000-00000000000e');
insert into public.conversations (id, vendor_id, family_user_id, family_name) values
  ('cf000000-0000-4000-8000-000000000001', 'bf000000-0000-4000-8000-000000000001',
   'af000000-0000-4000-8000-000000000001', 'Harjit K.');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('af000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.send_message('cf000000-0000-4000-8000-000000000001', 'voice', 'ignored',
       '{"path": "cf000000-0000-4000-8000-000000000001/1.m4a", "durationMs": 4200.4, "extra": 1}') $$,
  'A family sends a voice note'
);
select throws_ok(
  $$ select public.send_message('cf000000-0000-4000-8000-000000000001', 'voice', null,
       '{"path": "someone-else/1.m4a", "durationMs": 4200}') $$,
  '22023', 'invalid_voice',
  'The recording must be in this conversation''s folder'
);
select throws_ok(
  $$ select public.send_message('cf000000-0000-4000-8000-000000000001', 'voice', null,
       '{"path": "cf000000-0000-4000-8000-000000000001/2.m4a", "durationMs": 300001}') $$,
  '22023', 'invalid_voice',
  'Up to 5 minutes'
);
select pg_temp.as_user('af000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$ select public.send_message('cf000000-0000-4000-8000-000000000001', 'voice', null,
       '{"path": "cf000000-0000-4000-8000-000000000001/3.m4a", "durationMs": 9000}') $$,
  'The vendor replies with one'
);
reset role;

select is(
  (select body || '' from public.messages where data ->> 'path' like '%/1.m4a') is null
    and (select data from public.messages where data ->> 'path' like '%/1.m4a')
      = '{"path": "cf000000-0000-4000-8000-000000000001/1.m4a", "durationMs": 4200}'::jsonb,
  true,
  'Only the path and a whole number of milliseconds are kept, with no text'
);
select ok(
  (select 'audio/mp4' = any (allowed_mime_types) and 'image/jpeg' = any (allowed_mime_types)
   from storage.buckets where id = 'chat-media'),
  'The chat bucket takes recordings as well as photos'
);

select * from finish();
rollback;
