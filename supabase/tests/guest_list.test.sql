-- Guest list and per-event RSVP: only the owner and editors see or change
-- guests, lists, invites and sends; guests answer logged out with their token.

begin;
create extension if not exists pgtap with schema extensions;

select plan(71);

-- People: Asha (owner), Balwinder (editor), Charan (suggester), Dev (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a8000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-g@example.com'),
  ('b8000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder-g@example.com'),
  ('c8000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan-g@example.com'),
  ('d8000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-g@example.com');

insert into public.vendors (id, slug, status, name, base_city_slug, location) values
  ('98000000-0000-4000-8000-000000000001', 'guests-test-hall', 'published', 'Guests Test Hall', 'yuba-city', 'SRID=4326;POINT(-121.6169 39.1404)');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select value::uuid from pg_temp.ids where name = p_name;
$$;
create function pg_temp.event(p_slug text) returns uuid language sql as $$
  select id from public.wedding_events where wedding_id = pg_temp.id('wedding') and event_slug = p_slug;
$$;
create function pg_temp.token(p_name text) returns text language sql as $$
  select rsvp_token from public.wedding_guests where id = pg_temp.id(p_name);
$$;

set local role authenticated;

-- Asha's wedding (Mehndi and Reception), a second one for the limits, and
-- Balwinder and Charan join the first
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'wedding', public.create_wedding(p_title => 'Asha & Ravi', p_events => array['mehndi', 'reception'])::text;
insert into pg_temp.ids
select 'other', public.create_wedding(p_title => 'Limits', p_events => array['reception'])::text;
insert into pg_temp.ids
select 'editor_invite', public.create_wedding_invite(pg_temp.id('wedding'), 'editor');
insert into pg_temp.ids
select 'suggester_invite', public.create_wedding_invite(pg_temp.id('wedding'), 'suggester');
select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
select public.accept_wedding_invite((select value from pg_temp.ids where name = 'editor_invite'));
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select public.accept_wedding_invite((select value from pg_temp.ids where name = 'suggester_invite'));

-- Adding guests ------------------------------------------------------------------------

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'first_add', array_to_string(public.add_guests(pg_temp.id('wedding'), '[
  {"name": "  Sandhu family ", "phone": "+15305550201", "party_size": 4},
  {"name": "Preet", "email": "  Preet@Example.com "},
  {"name": "Sandhu again", "phone": "+15305550201"},
  {"name": "Nani ji"}
]'), ',');

select is(
  cardinality(string_to_array((select value from pg_temp.ids where name = 'first_add'), ',')),
  3,
  'A phone given twice in one batch is one guest'
);
select results_eq(
  $$ select name, phone, email, party_size::integer from public.wedding_guests
     where wedding_id = pg_temp.id('wedding') order by name $$,
  $$ values ('Nani ji'::text, null::text, null::text, 1),
            ('Preet', null, 'preet@example.com', 1),
            ('Sandhu family', '+15305550201', null, 4) $$,
  'Names are trimmed, emails lowercased, and the party size defaults to one'
);
insert into pg_temp.ids select 'sandhu', id::text from public.wedding_guests where name = 'Sandhu family';
insert into pg_temp.ids select 'preet', id::text from public.wedding_guests where name = 'Preet';
insert into pg_temp.ids select 'nani', id::text from public.wedding_guests where name = 'Nani ji';

select is(
  public.add_guests(pg_temp.id('wedding'), '[{"name": "S. family", "phone": "+15305550201"}]'),
  array[pg_temp.id('sandhu')],
  'Adding a phone that''s already there returns that guest'
);
select is(
  (select name from public.wedding_guests where id = pg_temp.id('sandhu')),
  'Sandhu family',
  'and leaves them as they were'
);
select throws_ok(
  $$ select public.add_guests(pg_temp.id('wedding'), '[{"name": "Bad", "phone": "5305550201"}]') $$,
  '23514', null,
  'Phones must be in E.164'
);
select throws_ok(
  $$ select public.add_guests(pg_temp.id('wedding'), '[]') $$,
  '22023', 'invalid_guests',
  'An empty batch is refused'
);
select throws_ok(
  $$ select public.add_guests(pg_temp.id('other'),
       (select jsonb_agg(jsonb_build_object('name', 'Guest ' || i)) from generate_series(1, 501) i)) $$,
  '22023', 'too_many_guests',
  'At most 500 guests at a time'
);
select public.add_guests(pg_temp.id('other'),
  (select jsonb_agg(jsonb_build_object('name', 'Guest ' || i)) from generate_series(1, 500) i));
select public.add_guests(pg_temp.id('other'),
  (select jsonb_agg(jsonb_build_object('name', 'More ' || i)) from generate_series(1, 499) i));
select throws_ok(
  $$ select public.add_guests(pg_temp.id('other'), '[{"name": "The thousandth"}, {"name": "One too many"}]') $$,
  'P0001', 'guest_limit',
  'At most 1,000 guests per wedding'
);
insert into pg_temp.ids
select 'stranger_guest', (select id from public.wedding_guests where wedding_id = pg_temp.id('other') limit 1)::text;

-- Who sees them ----------------------------------------------------------------------

select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
insert into pg_temp.ids
select 'bal_guest', (public.add_guests(pg_temp.id('wedding'), '[{"name": "Bal''s cousin", "phone": "+15305550203"}]'))[1]::text;
select is(
  (select count(*)::integer from public.wedding_guests),
  4,
  'An editor adds guests and sees all of them'
);

select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select is_empty($$ select 1 from public.wedding_guests $$, 'A suggester sees no guests');
select throws_ok(
  $$ select public.add_guests(pg_temp.id('wedding'), '[{"name": "Charan''s friend"}]') $$,
  '42501', 'not_allowed',
  'and can''t add any'
);

select pg_temp.as_user('d8000000-0000-4000-8000-00000000000d');
select is_empty(
  $$ select 1 from public.wedding_guests union all select 1 from public.guest_lists
     union all select 1 from public.guest_invites union all select 1 from public.invite_sends $$,
  'A stranger sees nothing'
);

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ insert into public.wedding_guests (wedding_id, name) values (pg_temp.id('wedding'), 'Direct') $$,
  '42501', null,
  'Guests are only added through add_guests'
);

-- Changing a guest ---------------------------------------------------------------------

select public.update_guest(pg_temp.id('preet'), ' Preet Kaur ', '+15305550202', '', 2);
select results_eq(
  $$ select name, phone, email, party_size::integer from public.wedding_guests where id = pg_temp.id('preet') $$,
  $$ values ('Preet Kaur'::text, '+15305550202'::text, null::text, 2) $$,
  'The owner changes a guest (an empty email clears it)'
);
select throws_ok(
  $$ select public.update_guest(pg_temp.id('preet'), 'Preet Kaur', '+15305550201', null, 2) $$,
  '23505', null,
  'Two guests can''t share a phone'
);
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.update_guest(pg_temp.id('preet'), 'Hacked', null, null, 1) $$,
  '42501', 'not_allowed',
  'A suggester can''t change a guest'
);

-- Lists -------------------------------------------------------------------------------

select throws_ok(
  $$ select public.create_guest_list(pg_temp.id('wedding'), 'Charan''s list') $$,
  '42501', 'not_allowed',
  'A suggester can''t make a list'
);

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'mehndi_list', public.create_guest_list(pg_temp.id('wedding'), ' Mehndi list ')::text;
insert into pg_temp.ids select 'dads_list', public.create_guest_list(pg_temp.id('wedding'), 'Dad''s side')::text;
select throws_ok(
  $$ select public.create_guest_list(pg_temp.id('wedding'), 'mehndi LIST') $$,
  '23505', 'list_name_taken',
  'List names are unique in any case'
);
select throws_ok(
  $$ select public.rename_guest_list(pg_temp.id('dads_list'), 'Mehndi list') $$,
  '23505', 'list_name_taken',
  'also when renaming'
);
select public.rename_guest_list(pg_temp.id('dads_list'), 'Mom''s side');
select is(
  (select name from public.guest_lists where id = pg_temp.id('dads_list')),
  'Mom''s side',
  'A list can be renamed'
);

select public.set_guest_list_members(pg_temp.id('mehndi_list'),
  array[pg_temp.id('sandhu'), pg_temp.id('preet'), pg_temp.id('stranger_guest')]);
select public.set_guest_list_members(pg_temp.id('dads_list'), array[pg_temp.id('nani'), pg_temp.id('preet')]);
select set_eq(
  $$ select guest_id from public.guest_list_members where list_id = pg_temp.id('mehndi_list') $$,
  $$ values (pg_temp.id('sandhu')), (pg_temp.id('preet')) $$,
  'A list holds this wedding''s guests only'
);
select public.set_guest_list_members(pg_temp.id('dads_list'), array[pg_temp.id('nani')]);
select set_eq(
  $$ select guest_id from public.guest_list_members where list_id = pg_temp.id('dads_list') $$,
  $$ values (pg_temp.id('nani')) $$,
  'Setting the members replaces them'
);

select public.create_guest_list(pg_temp.id('other'), 'List ' || i) from generate_series(1, 50) i;
select throws_ok(
  $$ select public.create_guest_list(pg_temp.id('other'), 'List 51') $$,
  'P0001', 'list_limit',
  'At most 50 lists per wedding'
);

-- Invites ---------------------------------------------------------------------------

select is(
  public.invite_to_event(pg_temp.id('wedding'), 'mehndi', p_list_id => pg_temp.id('mehndi_list')),
  2,
  'Inviting a whole list'
);
select is(
  public.invite_to_event(pg_temp.id('wedding'), 'reception',
    array[pg_temp.id('sandhu'), pg_temp.id('bal_guest'), pg_temp.id('stranger_guest')]),
  2,
  'Inviting guests by hand (another wedding''s guest is ignored)'
);
select is(
  public.invite_to_event(pg_temp.id('wedding'), 'mehndi', p_list_id => pg_temp.id('mehndi_list')),
  0,
  'Inviting again changes nothing'
);
select throws_ok(
  $$ select public.invite_to_event(pg_temp.id('wedding'), 'roka', array[pg_temp.id('sandhu')]) $$,
  'P0002', 'event_not_in_plan',
  'Only to the wedding''s own events'
);
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.invite_to_event(pg_temp.id('wedding'), 'mehndi', array[pg_temp.id('nani')]) $$,
  '42501', 'not_allowed',
  'A suggester can''t invite'
);

-- The RSVP page, logged out ---------------------------------------------------------

select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
update public.wedding_events set starts_at = '18:00', venue_text = 'Gurdwara Sahib, Yuba City'
where wedding_id = pg_temp.id('wedding') and event_slug = 'mehndi';
update public.wedding_events set venue_id = '98000000-0000-4000-8000-000000000001'
where wedding_id = pg_temp.id('wedding') and event_slug = 'reception';
select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
update public.wedding_events set event_date = '2027-04-22'
where wedding_id = pg_temp.id('wedding') and event_slug = 'mehndi';
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
update public.wedding_events set venue_text = 'Changed by a suggester'
where wedding_id = pg_temp.id('wedding') and event_slug = 'mehndi';

reset role;
insert into pg_temp.ids values
  ('sandhu_token', pg_temp.token('sandhu')), ('preet_token', pg_temp.token('preet')),
  ('nani_token', pg_temp.token('nani'));
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select results_eq(
  $$ select title, guest_name, party_size::integer, event_slug, event_date, starts_at, place, rsvp
     from public.rsvp_preview((select upper(value) from pg_temp.ids where name = 'sandhu_token')) $$,
  $$ values ('Asha & Ravi'::text, 'Sandhu family'::text, 4, 'mehndi'::text, '2027-04-22'::date,
             '18:00'::time, 'Gurdwara Sahib, Yuba City'::text, 'pending'::text),
            ('Asha & Ravi', 'Sandhu family', 4, 'reception', null, null, 'Guests Test Hall', 'pending') $$,
  'A guest sees the couple and the events they''re invited to, with the time and place the family set (a listed hall by name; any case of token)'
);
select results_eq(
  $$ select event_slug from public.rsvp_preview((select value from pg_temp.ids where name = 'preet_token')) $$,
  $$ values ('mehndi'::text) $$,
  'and only those events'
);
select results_eq(
  $$ select count(*)::integer, bool_and(event_slug is null)
     from public.rsvp_preview((select value from pg_temp.ids where name = 'nani_token')) $$,
  $$ values (1, true) $$,
  'Invited to nothing yet: one row with no event'
);
select is_empty(
  $$ select 1 from public.rsvp_preview('00000000000000000000000000000000') $$,
  'An unknown token shows nothing'
);

-- One link for the whole wedding (#337) --------------------------------------------------

reset role;
insert into pg_temp.ids select 'wedding_token', rsvp_token from public.weddings where id = pg_temp.id('wedding');
update public.wedding_guests set email = 'nani@example.com' where id = pg_temp.id('nani');
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is(
  public.rsvp_find((select value from pg_temp.ids where name = 'wedding_token'), ' (530) 555-0201 '),
  (select value from pg_temp.ids where name = 'sandhu_token'),
  'A guest types their number into the wedding link and gets their family''s RSVP (any spacing)'
);
select is(
  public.rsvp_find((select value from pg_temp.ids where name = 'wedding_token'), ' Nani@Example.com '),
  (select value from pg_temp.ids where name = 'nani_token'),
  'or their email, for a family listed without a phone'
);
select is(
  public.rsvp_find((select value from pg_temp.ids where name = 'wedding_token'), '+15305550999'),
  null,
  'A number not on the list finds nothing'
);
select throws_ok(
  $$ select public.rsvp_find('00000000000000000000000000000000', '+15305550201') $$,
  'P0002', 'rsvp_not_found',
  'An unknown wedding link is refused'
);
reset role;
update public.rsvp_lookups set misses = 20 where wedding_id = pg_temp.id('wedding');
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ select public.rsvp_find((select value from pg_temp.ids where name = 'wedding_token'), '+15305550201') $$,
  'P0001', 'find_limit',
  'After 20 misses in a day the link waits until tomorrow'
);

set local role authenticated;
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.set_wedding_rsvp_link(pg_temp.id('wedding'), 'off') $$,
  '42501', 'not_allowed',
  'A suggester can''t change the wedding link'
);
select pg_temp.as_user('b8000000-0000-4000-8000-00000000000b');
select is(public.set_wedding_rsvp_link(pg_temp.id('wedding'), 'off'), null, 'An editor turns the wedding link off');
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ select public.rsvp_find((select value from pg_temp.ids where name = 'wedding_token'), '+15305550201') $$,
  'P0002', 'rsvp_not_found',
  'and the old link stops working'
);
set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'wedding_token_2', public.set_wedding_rsvp_link(pg_temp.id('wedding'), 'on');
select isnt(
  (select value from pg_temp.ids where name = 'wedding_token_2'),
  (select value from pg_temp.ids where name = 'wedding_token'),
  'Turning it back on makes a new link'
);
select is(
  public.set_wedding_rsvp_link(pg_temp.id('wedding'), 'on'),
  (select value from pg_temp.ids where name = 'wedding_token_2'),
  'On keeps the link that''s on'
);
select isnt(
  public.set_wedding_rsvp_link(pg_temp.id('wedding'), 'new'),
  (select value from pg_temp.ids where name = 'wedding_token_2'),
  'New replaces it'
);
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ select 1 from public.wedding_guests $$,
  '42501', null,
  'Logged out, the guest list itself stays closed'
);

select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'mehndi', 'yes');
select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'reception', 'yes', 3);
select public.rsvp((select value from pg_temp.ids where name = 'preet_token'), 'mehndi', 'no');
select results_eq(
  $$ select event_slug, rsvp, coming::integer, answered_at is not null
     from public.rsvp_preview((select value from pg_temp.ids where name = 'sandhu_token')) $$,
  $$ values ('mehndi'::text, 'yes'::text, 4, true), ('reception', 'yes', 3, true) $$,
  'Yes counts the whole party unless the guest says how many'
);
select results_eq(
  $$ select rsvp, coming::integer from public.rsvp_preview((select value from pg_temp.ids where name = 'preet_token')) $$,
  $$ values ('no'::text, 0) $$,
  'No means nobody is coming'
);
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'mehndi', 'yes', 5) $$,
  '22023', 'invalid_count',
  'No more than the party'
);
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'mehndi', 'yes', 0) $$,
  '22023', 'invalid_count',
  'and at least one for a yes'
);
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'mehndi', 'maybe') $$,
  '22023', 'invalid_answer',
  'The answer is yes or no'
);
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'preet_token'), 'reception', 'yes') $$,
  'P0002', 'not_invited',
  'A guest can''t answer for an event they aren''t invited to'
);
select throws_ok(
  $$ select public.rsvp('00000000000000000000000000000000', 'mehndi', 'yes') $$,
  'P0002', 'rsvp_not_found',
  'An unknown token can''t answer'
);

select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'mehndi', 'yes', 4);
reset role;
select is(
  (select answer_count::integer from public.guest_invites where guest_id = pg_temp.id('sandhu') and wedding_event_id = pg_temp.event('mehndi')),
  1,
  'Saying the same thing again doesn''t count as a change'
);
update public.guest_invites set answer_count = 50
where guest_id = pg_temp.id('sandhu') and wedding_event_id = pg_temp.event('reception');
set local role anon;
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'reception', 'no') $$,
  'P0001', 'rsvp_limit',
  'At most 50 changes per event, since the page is public'
);

-- The numbers --------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select event_slug, invited, yes, no, pending, people_invited, coming
     from public.guest_summary(pg_temp.id('wedding')) $$,
  $$ values ('mehndi'::text, 2, 1, 1, 0, 6, 4), ('reception', 2, 1, 0, 1, 5, 3) $$,
  'The summary counts guests, answers and people per event'
);
select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select is_empty($$ select 1 from public.guest_summary(pg_temp.id('wedding')) $$, 'A suggester gets no summary');

-- Sends --------------------------------------------------------------------------------

select throws_ok(
  $$ select public.log_invite_sends(pg_temp.id('wedding'), array[pg_temp.id('sandhu')], 'text') $$,
  '42501', 'not_allowed',
  'A suggester can''t log sends'
);
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select is(
  public.log_invite_sends(pg_temp.id('wedding'),
    array[pg_temp.id('sandhu'), pg_temp.id('preet'), pg_temp.id('stranger_guest')], 'text'),
  2,
  'Sends are logged for this wedding''s guests'
);
select throws_ok(
  $$ select public.log_invite_sends(pg_temp.id('wedding'), array[pg_temp.id('sandhu')], 'whatsapp') $$,
  '22023', 'invalid_channel',
  'by text or email'
);
select throws_ok(
  $$ select public.log_invite_sends(pg_temp.id('other'), array(select gen_random_uuid() from generate_series(1, 501)), 'email') $$,
  '22023', 'too_many_guests',
  'At most 500 at a time'
);
reset role;
insert into public.invite_sends (guest_id, wedding_id, channel)
select pg_temp.id('stranger_guest'), pg_temp.id('other'), 'email' from generate_series(1, 2000);
set local role authenticated;
select throws_ok(
  $$ select public.log_invite_sends(pg_temp.id('other'), array[pg_temp.id('stranger_guest')], 'email') $$,
  'P0001', 'send_limit',
  'At most 2,000 a day per wedding'
);

-- Taking a guest off one event ---------------------------------------------------------

select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.uninvite_from_event(pg_temp.id('wedding'), 'reception', array[pg_temp.id('sandhu')]) $$,
  '42501', 'not_allowed',
  'A suggester can''t take a guest off an event'
);
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.uninvite_from_event(pg_temp.id('wedding'), 'roka', array[pg_temp.id('sandhu')]) $$,
  'P0002', 'event_not_in_plan',
  'Only off the wedding''s own events'
);
select is(
  public.uninvite_from_event(pg_temp.id('wedding'), 'reception',
    array[pg_temp.id('sandhu'), pg_temp.id('stranger_guest')]),
  1,
  'The owner takes a guest off one event (another wedding''s guest is ignored)'
);
select results_eq(
  $$ select e.event_slug, i.rsvp from public.guest_invites i
     join public.wedding_events e on e.id = i.wedding_event_id
     where i.guest_id = pg_temp.id('sandhu') $$,
  $$ values ('mehndi'::text, 'yes'::text) $$,
  'Their other invites and answers stay'
);
select throws_ok(
  $$ select public.rsvp((select value from pg_temp.ids where name = 'sandhu_token'), 'reception', 'yes') $$,
  'P0002', 'not_invited',
  'and their RSVP link can''t answer for that event any more'
);
select is(
  public.invite_to_event(pg_temp.id('wedding'), 'reception', array[pg_temp.id('sandhu')]),
  1,
  'Inviting them again starts a fresh invite'
);

-- Removing ----------------------------------------------------------------------------

select pg_temp.as_user('c8000000-0000-4000-8000-00000000000c');
select public.remove_guest(pg_temp.id('preet'));
select pg_temp.as_user('a8000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::integer from public.wedding_guests where id = pg_temp.id('preet')),
  1,
  'A suggester can''t remove a guest'
);
select public.remove_guest(pg_temp.id('preet'));
select is(
  (select count(*)::integer from public.wedding_guests where id = pg_temp.id('preet'))
  + (select count(*)::integer from public.guest_list_members where guest_id = pg_temp.id('preet'))
  + (select count(*)::integer from public.guest_invites where guest_id = pg_temp.id('preet'))
  + (select count(*)::integer from public.invite_sends where guest_id = pg_temp.id('preet')),
  0,
  'Removing a guest takes them off every list, invite and send'
);
select public.delete_guest_list(pg_temp.id('mehndi_list'));
select results_eq(
  $$ select (select count(*)::integer from public.guest_lists where id = pg_temp.id('mehndi_list')),
            (select count(*)::integer from public.guest_invites where guest_id = pg_temp.id('sandhu')) $$,
  $$ values (0, 2) $$,
  'Deleting a list keeps its guests and their invites'
);
insert into pg_temp.ids select 'mehndi_event', pg_temp.event('mehndi')::text;
delete from public.wedding_events where wedding_id = pg_temp.id('wedding') and event_slug = 'mehndi';
select is(
  (select count(*)::integer from public.guest_invites where wedding_event_id = pg_temp.id('mehndi_event')),
  0,
  'Removing an event removes its invites'
);
delete from public.weddings where id = pg_temp.id('wedding');
reset role;
select is(
  (select count(*)::integer from public.wedding_guests where wedding_id = pg_temp.id('wedding')),
  0,
  'Deleting the wedding deletes its guests'
);

select * from finish();
rollback;
