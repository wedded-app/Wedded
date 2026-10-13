-- Reels from Instagram and TikTok (B1): adding a reel by pasting a post's
-- address, no post added twice, where each reel came from, the feed's event
-- filter, and linked accounts (owners only; tokens never through the API).

begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- People: Asha (a family), Bal (another family) and Dev, who runs Link Hall
insert into auth.users (id, instance_id, aud, role, email) values
  ('a8000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-links@example.com'),
  ('b8000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bal-links@example.com'),
  ('d8000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-links@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a8000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550401'),
  ('b8000000-0000-4000-8000-00000000000b', 'Bal Singh', 'Yuba City', '+15305550402'),
  ('d8000000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fremont', '+15105550404');
insert into public.vendors (id, slug, status, name, city, location) values
  ('98000000-0000-4000-8000-000000000001', 'link-hall', 'published', 'Link Hall', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('98000000-0000-4000-8000-000000000002', 'link-dhol', 'published', 'Link Dhol', 'Yuba City', 'SRID=4326;POINT(-121.6169 39.1404)');
insert into public.vendor_members (vendor_id, user_id) values
  ('98000000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-00000000000d');
-- Asha linked her TikTok, Bal his Instagram (written by an Edge Function in real life)
insert into public.linked_accounts (id, user_id, platform, external_id, handle) values
  ('e8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-00000000000a', 'tiktok', 'tt-asha', 'ashakaur'),
  ('e8000000-0000-4000-8000-000000000002', 'b8000000-0000-4000-8000-00000000000b', 'instagram', 'ig-bal', 'balsingh');
insert into public.linked_account_tokens (account_id, access_token) values
  ('e8000000-0000-4000-8000-000000000001', 'secret-token');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

-- The rules on the table itself ----------------------------------------------------------------

select throws_ok(
  $$ insert into public.reels (author_id, source, duration_s)
     values ('a8000000-0000-4000-8000-00000000000a', 'upload', 20) $$,
  '23514', null,
  'An upload always has its video file'
);
select throws_ok(
  $$ insert into public.reels (author_id, source, platform, source_id, source_url, video_path, duration_s)
     values ('a8000000-0000-4000-8000-00000000000a', 'link', 'tiktok', '7400000000000000001',
       'https://www.tiktok.com/@x/video/7400000000000000001', 'a8000000-0000-4000-8000-00000000000a/x.mp4', 20) $$,
  '23514', null,
  'and a pasted link never has one'
);
select throws_ok(
  $$ insert into public.reels (author_id, source, video_path, duration_s)
     values ('a8000000-0000-4000-8000-00000000000a', 'link', null, null) $$,
  '23514', null,
  'A link says which post it is'
);

set local role authenticated;

-- Pasting a link ------------------------------------------------------------------------------------

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.create_linked_reel('https://www.tiktok.com/@gabrudhol/video/7412345678901234567',
       'Dhol at our jaago', 'jaago', '{}', null, false) $$,
  '22023', 'consent_required',
  'Adding a link needs the "everyone in it is okay with this" tick too'
);
select throws_ok(
  $$ select public.create_linked_reel('https://vm.tiktok.com/ZMabc123/', null, null, '{}', null, true) $$,
  '22023', 'unsupported_link',
  'A short share link has to be opened first'
);
select throws_ok(
  $$ select public.create_linked_reel('http://www.tiktok.com/@gabrudhol/video/7412345678901234567', null, null, '{}', null, true) $$,
  '22023', 'unsupported_link',
  'Only secure (https) addresses'
);
select throws_ok(
  $$ select public.create_linked_reel('https://www.youtube.com/watch?v=abc', null, null, '{}', null, true) $$,
  '22023', 'unsupported_link',
  'Only TikTok and Instagram posts'
);

insert into pg_temp.ids
select 'tiktok', public.create_linked_reel(
  'https://www.tiktok.com/@gabrudhol/video/7412345678901234567?is_from_webapp=1&sender_device=pc',
  '  Dhol at our jaago  ', 'jaago', array['98000000-0000-4000-8000-000000000002']::uuid[], null, true)::text;
select results_eq(
  $$ select source, platform, source_id, source_url, credit_name, caption, video_path, event_slug
     from public.reels where id = (select value::uuid from pg_temp.ids where name = 'tiktok') $$,
  $$ values ('link'::text, 'tiktok'::text, '7412345678901234567'::text,
       'https://www.tiktok.com/@gabrudhol/video/7412345678901234567'::text, '@gabrudhol'::text,
       'Dhol at our jaago'::text, null::text, 'jaago'::text) $$,
  'A family adds a TikTok by its address: tidied, credited to its maker, with no file of ours'
);
select is(
  (select status from public.reel_vendor_tags
   where reel_id = (select value::uuid from pg_temp.ids where name = 'tiktok')),
  'pending',
  'and the vendor they tagged approves it, as with uploads'
);
select throws_ok(
  $$ select public.create_linked_reel('https://m.tiktok.com/@gabrudhol/video/7412345678901234567/', null, null, '{}', null, true) $$,
  '23505', 'already_added',
  'The same TikTok can''t be added twice, however its address is written'
);

insert into pg_temp.ids
select 'instagram', public.create_linked_reel(
  'https://instagram.com/reels/C9xYz_Ab12/?igsh=abc', null, 'mehndi', '{}', null, true, 'Henna by Harleen')::text;
select results_eq(
  $$ select platform, source_id, source_url, credit_name
     from public.reels where id = (select value::uuid from pg_temp.ids where name = 'instagram') $$,
  $$ values ('instagram'::text, 'C9xYz_Ab12'::text, 'https://www.instagram.com/reel/C9xYz_Ab12/'::text,
       'Henna by Harleen'::text) $$,
  'An Instagram reel works too, credited by name'
);
select throws_ok(
  $$ select public.create_linked_reel('https://www.instagram.com/p/C9xYz_Ab12/', null, null, '{}', null, true) $$,
  '23505', 'already_added',
  'and the same post shared as /p/ is still the same post'
);

select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ select public.create_linked_reel('https://www.tiktok.com/@gabrudhol/video/7412345678901234567', null, null, '{}', null, true) $$,
  '23505', 'already_added',
  'Nobody else can add it again either'
);
select throws_ok(
  $$ select public.create_linked_reel('https://www.tiktok.com/@linkhall/video/7400000000000000002', null, null,
       '{}', '98000000-0000-4000-8000-000000000001', true) $$,
  '42501', 'not_allowed',
  'Only a business''s members post as it'
);

select pg_temp.as_user('d8000000-0000-4000-8000-00000000000d');
insert into pg_temp.ids
select 'hall', public.create_linked_reel('https://www.tiktok.com/@linkhall/video/7400000000000000002',
  'Our reception setup', 'reception', '{}', '98000000-0000-4000-8000-000000000001', true)::text;
select is(
  (select status from public.reel_vendor_tags
   where reel_id = (select value::uuid from pg_temp.ids where name = 'hall')),
  'approved',
  'A vendor posts its own TikTok as the business'
);

-- The feed --------------------------------------------------------------------------------------------

set local role anon;
select pg_temp.as_user(null);
select set_eq(
  $$ select id::text from public.reels_feed('for_you', null, 30)
     where id::text in (select value from pg_temp.ids) $$,
  $$ select value from pg_temp.ids $$,
  'The feed shows pasted reels to everyone'
);
select is(
  (select bool_and(event_slug = 'jaago')
     and bool_or(id::text = (select value from pg_temp.ids where name = 'tiktok'))
   from public.reels_feed('for_you', null, 30, null, null, 'jaago')),
  true,
  'and filters by event: only jaago reels, ours among them'
);
select is_empty(
  $$ select 1 from public.reels_feed('for_you', null, 30, null, null, 'mehndi')
     where id::text in (select value from pg_temp.ids where name in ('tiktok', 'hall')) $$,
  'Reels from other events stay out'
);
select results_eq(
  $$ select source, platform, source_url, credit_name from public.reels_feed('for_you', null, 30, null, null, 'mehndi')
     where id::text = (select value from pg_temp.ids where name = 'instagram') $$,
  $$ values ('link'::text, 'instagram'::text, 'https://www.instagram.com/reel/C9xYz_Ab12/'::text, 'Henna by Harleen'::text) $$,
  'Each reel says where it came from, so the app can show the original post'
);
select throws_ok(
  $$ select public.create_linked_reel('https://www.tiktok.com/@someone/video/7400000000000000003', null, null, '{}', null, true) $$,
  '42501', null,
  'Signed out, nobody adds reels'
);

-- Linked accounts ------------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select handle from public.linked_accounts $$,
  $$ values ('ashakaur'::text) $$,
  'People see only their own linked accounts'
);
select throws_ok(
  $$ insert into public.linked_accounts (user_id, platform, external_id)
     values ('a8000000-0000-4000-8000-00000000000a', 'instagram', 'ig-fake') $$,
  '42501', null,
  'and can''t link one by hand: linking goes through the platform'
);
select throws_ok(
  $$ select access_token from public.linked_account_tokens $$,
  '42501', null,
  'Login tokens are never readable through the API'
);
delete from public.linked_accounts where id = 'e8000000-0000-4000-8000-000000000002';
delete from public.linked_accounts where id = 'e8000000-0000-4000-8000-000000000001';
reset role;
select results_eq(
  $$ select id::text from public.linked_accounts order by id $$,
  $$ values ('e8000000-0000-4000-8000-000000000002'::text) $$,
  'Owners remove their own linked account, nobody else''s'
);
select is_empty(
  $$ select 1 from public.linked_account_tokens $$,
  'and its login goes with it'
);
select throws_ok(
  $$ insert into public.linked_accounts (user_id, platform, external_id)
     values ('a8000000-0000-4000-8000-00000000000a', 'instagram', 'ig-bal') $$,
  '23505', null,
  'One Wedded App person per Instagram or TikTok account'
);

select * from finish();
rollback;
