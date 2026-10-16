-- Clearing stories: expired_stories() lists what the hourly clear-stories
-- job deletes, keeps reported ones for the founders, and only the service
-- role can call it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a9000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-clear@example.com');
insert into public.profiles (id, full_name, city, phone) values
  ('a9000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550501');
insert into public.stories (id, author_id, kind, media_path, thumb_path, duration_s, created_at) values
  ('59000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-00000000000a', 'photo', 'a9000000-0000-4000-8000-00000000000a/old.jpg', null, null, now() - interval '30 hours'),
  ('59000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-00000000000a', 'video', 'a9000000-0000-4000-8000-00000000000a/clip.mp4', 'a9000000-0000-4000-8000-00000000000a/clip.jpg', 8, now() - interval '26 hours'),
  ('59000000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-00000000000a', 'photo', 'a9000000-0000-4000-8000-00000000000a/today.jpg', null, null, now() - interval '3 hours'),
  ('59000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-00000000000a', 'photo', 'a9000000-0000-4000-8000-00000000000a/reported.jpg', null, null, now() - interval '28 hours'),
  ('59000000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-00000000000a', 'photo', 'a9000000-0000-4000-8000-00000000000a/looked-at.jpg', null, null, now() - interval '28 hours');
insert into public.reel_reports (story_id, reason, status) values
  ('59000000-0000-4000-8000-000000000004', 'harassment', 'open'),
  ('59000000-0000-4000-8000-000000000005', 'spam', 'dismissed');

set local role service_role;
select results_eq(
  $$ select id::text, media_path, thumb_path from public.expired_stories() $$,
  $$ values
    ('59000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-00000000000a/old.jpg', null::text),
    ('59000000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-00000000000a/looked-at.jpg', null),
    ('59000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-00000000000a/clip.mp4', 'a9000000-0000-4000-8000-00000000000a/clip.jpg') $$,
  'Stories over a day old, oldest first, with their files'
);
select ok(
  not exists (select 1 from public.expired_stories() where id = '59000000-0000-4000-8000-000000000003'),
  'not today''s'
);
select ok(
  not exists (select 1 from public.expired_stories() where id = '59000000-0000-4000-8000-000000000004'),
  'and not one waiting on the founders to look at its report'
);
select is((select count(*)::int from public.expired_stories(1)), 1, 'The job asks for one to see if there''s work');
reset role;

select ok(
  not has_function_privilege('authenticated', 'public.expired_stories(integer)', 'execute')
    and not has_function_privilege('anon', 'public.expired_stories(integer)', 'execute'),
  'Only the service role can list them'
);

select * from finish();
rollback;
