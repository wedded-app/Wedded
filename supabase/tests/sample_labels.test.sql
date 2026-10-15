-- Sample labels (#239): sample vendors, reels and people are marked, and
-- nobody can mark themselves.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a2390000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sample-reels-family-9@example.com'),
  ('a2390000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'real-family@example.com');
insert into public.profiles (id, full_name, city, phone, is_sample) values
  ('a2390000-0000-4000-8000-000000000001', 'Sample Family', 'Yuba City', '+15305550190', true),
  ('a2390000-0000-4000-8000-000000000002', 'Real Family', 'Yuba City', '+15305550191', false);
insert into public.reels (id, author_id, video_path, duration_s, created_at) values
  ('c2390000-0000-4000-8000-000000000001', 'a2390000-0000-4000-8000-000000000001',
   'a2390000-0000-4000-8000-000000000001/a.mp4', 10, now() + interval '1 day'),
  ('c2390000-0000-4000-8000-000000000002', 'a2390000-0000-4000-8000-000000000002',
   'a2390000-0000-4000-8000-000000000002/b.mp4', 10, now() + interval '1 day');

select is(
  (select bool_and(is_sample) from public.search_vendors(query => 'Royal Orchard', max_miles => null)),
  true,
  'Search marks the seed''s sample vendors'
);

set local role anon;
select is(
  (select is_sample from public.reels_feed('person', null, 10, 'a2390000-0000-4000-8000-000000000001')
   where id = 'c2390000-0000-4000-8000-000000000001'),
  true,
  'A sample account''s reel is marked'
);
select is(
  (select is_sample from public.reels_feed('person', null, 10, 'a2390000-0000-4000-8000-000000000002')
   where id = 'c2390000-0000-4000-8000-000000000002'),
  false,
  'A real family''s reel is not'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a2390000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.profiles set is_sample = true where id = 'a2390000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'Nobody can mark their own profile as a sample'
);
reset role;

select is(
  (select is_sample from public.profiles where id = 'a2390000-0000-4000-8000-000000000001'),
  true,
  'The service role keeps the flag'
);

select * from finish();
rollback;
