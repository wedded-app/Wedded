-- Wedding websites: owners and editors make and change the site, members see
-- drafts, guests see a published site logged out (only their own events on
-- their own link), and a password keeps everyone else out.

begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

-- People: Asha (owner), Balwinder (editor), Charan (suggester), Dev (a stranger)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a9000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-s@example.com'),
  ('b9000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder-s@example.com'),
  ('c9000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan-s@example.com'),
  ('d9000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-s@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select value::uuid from pg_temp.ids where name = p_name;
$$;
create function pg_temp.val(p_name text) returns text language sql as $$
  select value from pg_temp.ids where name = p_name;
$$;
create function pg_temp.slugs(page jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'slug' order by n), '{}')
  from jsonb_array_elements(page -> 'events') with ordinality as t(e, n);
$$;

set local role authenticated;

-- Asha's wedding (Mehndi, Anand Karaj, Reception); Balwinder and Charan join it
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select 'wedding', public.create_wedding(p_title => 'Asha & Ravi', p_events => array['mehndi', 'anand-karaj', 'reception'])::text;
insert into pg_temp.ids
select 'twin', public.create_wedding(p_title => 'Asha & Ravi', p_events => array['reception'])::text;
insert into pg_temp.ids
select 'short', public.create_wedding(p_title => 'J', p_events => array['reception'])::text;
insert into pg_temp.ids
select 'editor_invite', public.create_wedding_invite(pg_temp.id('wedding'), 'editor');
insert into pg_temp.ids
select 'suggester_invite', public.create_wedding_invite(pg_temp.id('wedding'), 'suggester');
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select public.accept_wedding_invite(pg_temp.val('editor_invite'));
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select public.accept_wedding_invite(pg_temp.val('suggester_invite'));

-- Guests: the Sandhus are invited to the Mehndi only, Preet to nothing yet
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select public.add_guests(pg_temp.id('wedding'), '[
  {"name": "Sandhu family", "phone": "+15305550301", "party_size": 4},
  {"name": "Preet", "phone": "+15305550302"}
]');
select public.add_guests(pg_temp.id('twin'), '[{"name": "Other wedding guest", "phone": "+15305550303"}]');
select public.invite_to_event(pg_temp.id('wedding'), 'mehndi',
  array[(select id from public.wedding_guests where name = 'Sandhu family')]);

-- Making the site ------------------------------------------------------------------------

select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.create_site(pg_temp.id('wedding')) $$,
  '42501', 'not_allowed', 'A stranger can''t make a wedding''s site'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.create_site(pg_temp.id('wedding')) $$,
  '42501', 'not_allowed', 'Nor can a suggester'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is(public.create_site(pg_temp.id('wedding')), 'asha-ravi', 'The site is named from the couple');
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select is(public.create_site(pg_temp.id('wedding')), 'asha-ravi', 'Making it again returns the same site');
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'twin_slug', public.create_site(pg_temp.id('twin'));
select matches(pg_temp.val('twin_slug'), '^asha-ravi-[0-9a-f]{4}$', 'Another couple with the same names gets a short suffix');
select is(public.create_site(pg_temp.id('short')), 'our-wedding', 'A name too short for a link becomes our-wedding');
select results_eq(
  $$ select design, published_at is null, sections from public.wedding_sites where wedding_id = pg_temp.id('wedding') $$,
  $$ values ('classic'::text, true, array['family', 'story', 'events', 'rsvp', 'guide', 'travel', 'livestream', 'faq']) $$,
  'A new site is a classic draft with every part in order'
);

-- Drafts are for the wedding's own people -----------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select is(
  public.site_page('asha-ravi') -> 'editor' ->> 'can_edit', 'false',
  'A suggester can preview the draft but not change it'
);
select is(
  pg_temp.slugs(public.site_page('asha-ravi')), array['anand-karaj', 'mehndi', 'reception'],
  'and sees every event'
);
select is(
  (select count(*)::integer from public.wedding_sites where wedding_id = pg_temp.id('wedding')), 1,
  'Members read their wedding''s site'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.site_page('asha-ravi') $$,
  'P0002', 'site_not_found', 'A stranger can''t see a draft'
);
select is_empty(
  $$ select 1 from public.wedding_sites where wedding_id = pg_temp.id('wedding') $$,
  'nor read its row'
);

-- Changing the site -----------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"design": "noor"}') $$,
  '42501', 'not_allowed', 'A suggester can''t change the site'
);
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{
       "design": "heirloom", "welcome": "  Welcome to our wedding!  ",
       "family_lines": ["  Gurmeet & Harjit Gill ", "", "Rajinder & Paramjit Sandhu"],
       "sections": ["events", "rsvp", "family"], "rsvp_by": "2027-05-01", "searchable": true
     }') $$,
  'An editor changes the design, words and parts'
);
select results_eq(
  $$ select design, welcome, family_lines, sections, rsvp_by, searchable
     from public.wedding_sites where wedding_id = pg_temp.id('wedding') $$,
  $$ values ('heirloom'::text, 'Welcome to our wedding!'::text,
             array['Gurmeet & Harjit Gill', 'Rajinder & Paramjit Sandhu'],
             array['events', 'rsvp', 'family'], '2027-05-01'::date, true) $$,
  'Words are trimmed, blank lines dropped, and only the keys given change'
);
select lives_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"welcome": null, "design": "", "searchable": false}') $$,
  'Null or "" clears a field'
);
select results_eq(
  $$ select design, welcome, searchable from public.wedding_sites where wedding_id = pg_temp.id('wedding') $$,
  $$ values ('classic'::text, null::text, false) $$,
  'and an empty design is classic again'
);
select throws_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"slug": "mine"}') $$,
  '22023', 'invalid_field', 'Only the site''s own fields can change this way'
);
select throws_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"sections": ["events", "gifts"]}') $$,
  '23514', null, 'Parts must be ones the site has'
);
select throws_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"sections": ["events", "events"]}') $$,
  '23514', null, 'each once'
);
select throws_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"livestream_url": "http://example.com/live"}') $$,
  '23514', null, 'Links must be https'
);
select lives_ok(
  $$ select public.update_site(pg_temp.id('wedding'), '{"design": "heirloom", "palette": "maroon",
       "sections": ["family", "events", "rsvp", "guide", "travel"], "guide_title": "At the gurdwara"}') $$,
  'Back to Heirloom in maroon, with the guide and travel'
);

-- Each event's details ---------------------------------------------------------------------

select lives_ok(
  $$ select public.set_event_site_details(pg_temp.id('wedding'), 'mehndi',
       '{"dress_code": " Greens and pinks ", "dress_colors": ["#4e8a4b", "#E46C9A"], "guest_note": "At home", "shown_publicly": false}') $$,
  'An editor sets what to wear, colours and a note, and keeps the Mehndi off the public page'
);
select results_eq(
  $$ select dress_code, dress_colors, guest_note, shown_publicly from public.wedding_events
     where wedding_id = pg_temp.id('wedding') and event_slug = 'mehndi' $$,
  $$ values ('Greens and pinks'::text, array['#4E8A4B', '#E46C9A'], 'At home'::text, false) $$,
  'Trimmed, colours in capitals'
);
select throws_ok(
  $$ select public.set_event_site_details(pg_temp.id('wedding'), 'mehndi', '{"dress_colors": ["green"]}') $$,
  '23514', null, 'Colours are #RRGGBB'
);
select throws_ok(
  $$ select public.set_event_site_details(pg_temp.id('wedding'), 'nikah', '{"dress_code": "Modest"}') $$,
  'P0002', 'event_not_in_plan', 'Only events in the plan'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.set_event_site_details(pg_temp.id('wedding'), 'mehndi', '{"dress_code": "Mine"}') $$,
  '42501', 'not_allowed', 'A suggester can''t'
);

-- Lists: the guide's tips, hotels and questions ---------------------------------------------

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is(
  public.set_site_items(pg_temp.id('wedding'), 'tip', '[
    {"title": " Please cover your head. "}, {"title": "   "}, {"title": "Shoes off", "body": "There are racks by the door"}
  ]'),
  2,
  'The guide''s tips are saved, blank ones dropped'
);
select results_eq(
  $$ select position::integer, title, body from public.wedding_site_items i
     join public.wedding_sites s on s.id = i.site_id
     where s.wedding_id = pg_temp.id('wedding') and i.kind = 'tip' order by position $$,
  $$ values (1, 'Please cover your head.'::text, null::text), (2, 'Shoes off', 'There are racks by the door') $$,
  'in order'
);
select throws_ok(
  $$ select public.set_site_items(pg_temp.id('wedding'), 'tip',
       (select jsonb_agg(jsonb_build_object('title', 'Tip ' || n)) from generate_series(1, 13) n)) $$,
  'P0001', 'too_many_items', 'At most 12 tips'
);
select throws_ok(
  $$ select public.set_site_items(pg_temp.id('wedding'), 'hotel', '[{"title": "Inn", "link": "javascript:alert(1)"}]') $$,
  '23514', null, 'Links must be https'
);
select is(
  public.set_site_items(pg_temp.id('wedding'), 'hotel', '[{"title": "Riverside Inn", "body": "Code GILL", "link": "https://example.com/book"}]'),
  1,
  'A hotel with its group code and booking link'
);
select throws_ok(
  $$ select public.set_site_items(pg_temp.id('wedding'), 'gift', '[]') $$,
  '22023', 'invalid_kind', 'Only tips, hotels and questions'
);
select is(
  public.set_site_items(pg_temp.id('wedding'), 'hotel', '[]'), 0,
  'An empty list clears it'
);
select public.set_site_items(pg_temp.id('wedding'), 'hotel', '[{"title": "Riverside Inn", "body": "Code GILL"}]');

-- Published: what guests see ------------------------------------------------------------------

select isnt(public.publish_site(pg_temp.id('wedding'), true), null, 'The owner publishes the site');

reset role;
insert into pg_temp.ids
select 'sandhu_token', rsvp_token from public.wedding_guests where name = 'Sandhu family';
insert into pg_temp.ids
select 'preet_token', rsvp_token from public.wedding_guests where name = 'Preet';
insert into pg_temp.ids
select 'stranger_token', rsvp_token from public.wedding_guests where name = 'Other wedding guest';
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is(
  pg_temp.slugs(public.site_page('asha-ravi')), array['anand-karaj', 'reception'],
  'Logged out, the public page shows the events open to everyone'
);
select results_eq(
  $$ select p ->> 'title', p ->> 'design', p ->> 'palette', p -> 'editor' = 'null'::jsonb, jsonb_array_length(p -> 'tips'),
       p -> 'hotels' -> 0 ->> 'body', p ->> 'rsvp_link' is not null
     from public.site_page('  Asha-Ravi ') as p $$,
  $$ values ('Asha & Ravi'::text, 'heirloom'::text, 'maroon'::text, true, 2, 'Code GILL'::text, true) $$,
  'with the couple, design, lists and the wedding''s RSVP link, and nothing for editors (any case of link)'
);
select is(
  pg_temp.slugs(public.site_page('asha-ravi', null, upper(pg_temp.val('sandhu_token')))), array['mehndi'],
  'A guest on their own link sees only their events, even ones kept off the public page'
);
select is(
  public.site_page('asha-ravi', null, pg_temp.val('sandhu_token')) -> 'guest' ->> 'name', 'Sandhu family',
  'and is greeted by name'
);
select is(
  pg_temp.slugs(public.site_page('asha-ravi', null, pg_temp.val('preet_token'))), array['anand-karaj', 'reception'],
  'A guest invited to nothing yet sees the public events'
);
select is(
  public.site_page('asha-ravi', null, pg_temp.val('stranger_token')) -> 'guest', 'null'::jsonb,
  'Another wedding''s guest token counts for nothing'
);
select throws_ok(
  $$ select public.site_page('asha-ravi-nope') $$,
  'P0002', 'site_not_found', 'An unknown link'
);

-- The password ----------------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.set_site_password(pg_temp.id('wedding'), 'abc') $$,
  '22023', 'invalid_password', 'A password has at least 4 characters'
);
select is(public.set_site_password(pg_temp.id('wedding'), ' Gill2027 '), true, 'The owner sets a password');
select is(
  public.site_page('asha-ravi') -> 'editor' ->> 'has_password', 'true',
  'The builder knows there is one, and members skip it'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select results_eq(
  $$ select p ->> 'locked', p ->> 'title', p ? 'events' from public.site_page('asha-ravi') as p $$,
  $$ values ('password_required'::text, 'Asha & Ravi'::text, false) $$,
  'Without it a guest sees only the couple''s names and a password box'
);
select is(
  public.site_page('asha-ravi', 'wrong') ->> 'locked', 'wrong_password',
  'A wrong password is turned away'
);
select is(
  pg_temp.slugs(public.site_page('asha-ravi', '  gILL2027 ')), array['anand-karaj', 'reception'],
  'The right one opens the page, whatever the capitals'
);
select is(
  pg_temp.slugs(public.site_page('asha-ravi', null, pg_temp.val('sandhu_token'))), array['mehndi'],
  'A guest on their own link needs no password'
);
select throws_ok(
  $$ select * from public.wedding_site_locks $$,
  '42501', null, 'Nobody reads the passwords'
);

reset role;
select is(
  (select misses from public.wedding_site_locks l join public.wedding_sites s on s.id = l.site_id
   where s.wedding_id = pg_temp.id('wedding')),
  1,
  'The wrong try was counted'
);
update public.wedding_site_locks set misses = 30
where site_id = (select id from public.wedding_sites where wedding_id = pg_temp.id('wedding'));
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$ select public.site_page('asha-ravi', 'Gill2027') $$,
  'P0001', 'password_limit', 'After 30 wrong tries the page waits until tomorrow'
);

reset role;
set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is(public.set_site_password(pg_temp.id('wedding'), null), false, 'Clearing the password');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(
  public.site_page('asha-ravi') ->> 'locked', null,
  'opens the page to everyone again'
);

-- The link ----------------------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select throws_ok(
  format($$ select public.set_site_slug(%L, %L) $$, pg_temp.id('wedding'), pg_temp.val('twin_slug')),
  '23505', 'slug_taken', 'Another wedding''s link is taken'
);
select throws_ok(
  $$ select public.set_site_slug(pg_temp.id('wedding'), ' !! ') $$,
  '22023', 'invalid_slug', 'A link needs at least 3 letters or numbers'
);
select is(
  public.set_site_slug(pg_temp.id('wedding'), 'Asha & Ravi 2027!'), 'asha-ravi-2027',
  'Spaces and symbols become dashes'
);
select throws_ok(
  $$ select public.site_page('asha-ravi') $$,
  'P0002', 'site_not_found', 'and the old link stops working'
);

-- The cover photo -----------------------------------------------------------------------------------

select throws_ok(
  $$ select public.set_site_cover(pg_temp.id('wedding'), 'f9000000-0000-4000-8000-000000000001') $$,
  'P0002', 'files_missing', 'The cover''s three sizes must be uploaded first'
);
select ok(
  private.can_write_site_file(pg_temp.val('wedding') || '/f9000000-0000-4000-8000-000000000001/1080.webp', false),
  'The owner may upload the site''s photos'
);
select ok(
  not private.can_write_site_file(pg_temp.val('wedding') || '/f9000000-0000-4000-8000-000000000001/huge.png', false),
  'but only the three WebP sizes'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select ok(
  not private.can_write_site_file(pg_temp.val('wedding') || '/f9000000-0000-4000-8000-000000000001/1080.webp', false),
  'A stranger may not'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into storage.objects (bucket_id, name, owner)
select 'site-media', pg_temp.val('wedding') || '/' || photo || '/' || size || '.webp', (select auth.uid())
from unnest(array['f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002']) as photo,
  unnest(array['400', '1080', '1600']) as size;
select is(
  public.set_site_cover(pg_temp.id('wedding'), 'f9000000-0000-4000-8000-000000000001'), null,
  'With the files there, the photo becomes the cover'
);
select ok(
  not private.can_write_site_file(pg_temp.val('wedding') || '/f9000000-0000-4000-8000-000000000001/1080.webp', true),
  'The cover''s files can''t be deleted while it''s the cover'
);
select is(
  public.set_site_cover(pg_temp.id('wedding'), 'f9000000-0000-4000-8000-000000000002'),
  pg_temp.val('wedding') || '/f9000000-0000-4000-8000-000000000001',
  'A new cover returns the old one''s folder to delete'
);

-- Suggestions for the guide ------------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(
  (select count(*)::integer from public.event_guest_tips where event_slug = 'anand-karaj'), 5,
  'Anyone can read the suggested tips for an Anand Karaj'
);

-- Deleting the wedding ------------------------------------------------------------------------------

reset role;
insert into pg_temp.ids select 'site', id::text from public.wedding_sites where wedding_id = pg_temp.id('wedding');
delete from public.weddings where id = pg_temp.id('wedding');
select results_eq(
  $$ select (select count(*)::integer from public.wedding_sites where id = pg_temp.id('site')),
            (select count(*)::integer from public.wedding_site_items where site_id = pg_temp.id('site')),
            (select count(*)::integer from public.wedding_site_locks where site_id = pg_temp.id('site')) $$,
  $$ values (0, 0, 0) $$,
  'Deleting the wedding deletes its site, lists and password'
);

select * from finish();
rollback;
