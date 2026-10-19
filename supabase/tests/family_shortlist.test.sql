-- Family shortlist: members see each other's saved vendors and reactions;
-- outsiders see nothing; each person changes only their own reaction.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('a3000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fs-asha@example.com'),
  ('b3000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fs-bal@example.com'),
  ('c3000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fs-charan@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a3000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550301'),
  ('b3000000-0000-4000-8000-00000000000b', 'Bal Singh', 'Yuba City', '+15305550302'),
  ('c3000000-0000-4000-8000-00000000000c', 'Charan Gill', 'Fremont', '+15105550303');

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('90000000-0000-4000-8000-000000000001', 'fs-hall', 'published', 'Fs Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)'),
  ('90000000-0000-4000-8000-000000000002', 'fs-dj', 'published', 'Fs DJ', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated;

set local role authenticated;
select pg_temp.as_user('a3000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'wedding', public.create_wedding(p_events => array['reception', 'jaago'])::text;
insert into pg_temp.ids select 'invite', public.create_wedding_invite((select value::uuid from pg_temp.ids where name = 'wedding'));
select public.save_vendor('90000000-0000-4000-8000-000000000001', 'reception');

select pg_temp.as_user('b3000000-0000-4000-8000-00000000000b');
select public.accept_wedding_invite((select value from pg_temp.ids where name = 'invite'));
select public.save_vendor('90000000-0000-4000-8000-000000000001', 'jaago');
select public.save_vendor('90000000-0000-4000-8000-000000000002', 'reception');
insert into public.shortlist_reactions (wedding_id, vendor_id, reaction)
values ((select value::uuid from pg_temp.ids where name = 'wedding'), '90000000-0000-4000-8000-000000000001', 'love');

select pg_temp.as_user('a3000000-0000-4000-8000-00000000000a');
insert into public.shortlist_reactions (wedding_id, vendor_id, reaction) values
  ((select value::uuid from pg_temp.ids where name = 'wedding'), '90000000-0000-4000-8000-000000000001', 'maybe'),
  ((select value::uuid from pg_temp.ids where name = 'wedding'), '90000000-0000-4000-8000-000000000002', 'no');

select results_eq(
  $$ select slug from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding')) $$,
  array['fs-hall', 'fs-dj'],
  'The family sees every vendor any member saved, best loved first'
);
select results_eq(
  $$ select saved_by, event_slugs, loves, maybes, nos, my_reaction, loved_by
     from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding'))
     where slug = 'fs-hall' $$,
  $$ values (array['Asha', 'Bal'], array['jaago', 'reception'], 1, 1, 0, 'maybe'::text, array['Bal']) $$,
  'with who saved it, for which events, the reaction counts, your own reaction and who loves it'
);

update public.shortlist_reactions set reaction = 'no'
where user_id = 'b3000000-0000-4000-8000-00000000000b';
select is(
  (select loves from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding')) where slug = 'fs-hall'),
  1,
  'Nobody can change someone else''s reaction'
);

update public.shortlist_reactions set reaction = 'love'
where user_id = 'a3000000-0000-4000-8000-00000000000a' and vendor_id = '90000000-0000-4000-8000-000000000001';
select is(
  (select loves from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding')) where slug = 'fs-hall'),
  2,
  'Changing your own mind works'
);

select public.react_to_vendor((select value::uuid from pg_temp.ids where name = 'wedding'), '90000000-0000-4000-8000-000000000002', 'maybe');
select is(
  (select my_reaction from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding')) where slug = 'fs-dj'),
  'maybe',
  'react_to_vendor sets or changes your reaction in one call'
);

select pg_temp.as_user('c3000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::int from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding'))),
  0,
  'Outsiders see no shortlist'
);
select is(
  (select count(*)::int from public.shortlist_reactions),
  0,
  'or reactions'
);
select throws_ok(
  $$ insert into public.shortlist_reactions (wedding_id, vendor_id, reaction)
     values ((select value::uuid from pg_temp.ids where name = 'wedding'), '90000000-0000-4000-8000-000000000001', 'love') $$,
  '42501', null,
  'and can''t react'
);

select pg_temp.as_user('b3000000-0000-4000-8000-00000000000b');
select public.remove_wedding_member((select value::uuid from pg_temp.ids where name = 'wedding'), 'b3000000-0000-4000-8000-00000000000b');

select pg_temp.as_user('a3000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select slug from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding')) $$,
  array['fs-hall'],
  'When someone leaves, their saves leave the family shortlist'
);
select is(
  (select loves from public.wedding_shortlist((select value::uuid from pg_temp.ids where name = 'wedding'))),
  1,
  'and their reactions stop counting'
);

select * from finish();
rollback;
