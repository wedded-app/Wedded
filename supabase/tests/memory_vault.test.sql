-- Memory Vault (#306): opening a wedding's vault, joining with its link,
-- uploading and saving photos and videos, who sees what, hiding, locking,
-- removing, the booked vendors, leaving, stopping the link, limits, clearing
-- files nobody points to, and deleting accounts and weddings.

begin;
create extension if not exists pgtap with schema extensions;

select plan(104);

-- People: Asha (owns the wedding), Balwinder (editor), Charan (suggester),
-- Dev and Farah (guests who join with the link), Esha (a stranger, later a guest)
insert into auth.users (id, instance_id, aud, role, email) values
  ('a9000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha@example.com'),
  ('b9000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'balwinder@example.com'),
  ('c9000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charan@example.com'),
  ('d9000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev@example.com'),
  ('e9000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esha@example.com'),
  ('f9000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'farah@example.com');

insert into public.profiles (id, full_name, city, phone) values
  ('a9000000-0000-4000-8000-00000000000a', 'Asha Kaur', 'Yuba City', '+15305550901'),
  ('d9000000-0000-4000-8000-00000000000d', 'Dev Sandhu', 'Fresno', '+15595550904'),
  ('f9000000-0000-4000-8000-00000000000f', 'Farah Khan', 'Fremont', '+15105550906');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon, service_role;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select value::uuid from pg_temp.ids where name = p_name;
$$;
create function pg_temp.val(p_name text) returns text language sql as $$
  select value from pg_temp.ids where name = p_name;
$$;
-- A file's name in vault-media: <vault>/<user>/<item>/<file>
create function pg_temp.file(p_user text, p_item text, p_file text) returns text language sql as $$
  select pg_temp.id('vault')::text || '/' || p_user || '/' || p_item || '/' || p_file;
$$;
grant execute on function pg_temp.id, pg_temp.val, pg_temp.file to authenticated, anon, service_role;

set local role authenticated;
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'wedding', public.create_wedding(
  p_title => 'Jaspreet & Amrit',
  p_events => array['jaago', 'anand-karaj', 'reception']
)::text;
reset role;

insert into public.wedding_members (wedding_id, user_id, role) values
  (pg_temp.id('wedding'), 'b9000000-0000-4000-8000-00000000000b', 'editor'),
  (pg_temp.id('wedding'), 'c9000000-0000-4000-8000-00000000000c', 'suggester');

-- Opening ------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.open_memory_vault(pg_temp.id('wedding')) $$,
  '42501', null,
  'Logged-out people cannot open a vault'
);
reset role;

set local role authenticated;
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.open_memory_vault(pg_temp.id('wedding')) $$,
  '42501', 'not_allowed',
  'A suggester cannot open the vault'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.open_memory_vault(pg_temp.id('wedding')) $$,
  '42501', 'not_allowed',
  'A stranger cannot open it'
);

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is_empty(
  $$ select * from public.memory_vault(p_wedding_id => pg_temp.id('wedding')) $$,
  'Before it''s opened there is no vault'
);
insert into pg_temp.ids select 'vault', public.open_memory_vault(pg_temp.id('wedding'))::text;
select isnt(pg_temp.id('vault'), null, 'The owner opens the vault');
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select is(
  public.open_memory_vault(pg_temp.id('wedding')), pg_temp.id('vault'),
  'Opening it again, as an editor, gives the same vault'
);

select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select id, title, my_role, can_add, uploads_open, guests_see_all, show_vendors, item_count, guest_count
     from public.memory_vault(p_wedding_id => pg_temp.id('wedding')) $$,
  $$ values (pg_temp.id('vault'), 'Jaspreet & Amrit'::text, 'couple'::text, true, true, true, true, 0, 0) $$,
  'The couple finds it by their wedding: open to uploads, guests seeing everyone''s, vendors shown'
);
select is(
  (select jsonb_agg(e ->> 'slug' order by e ->> 'slug')
   from public.memory_vault(pg_temp.id('vault')) v, jsonb_array_elements(v.events) e),
  '["anand-karaj", "jaago", "reception"]'::jsonb,
  'It lists the wedding''s events'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select results_eq(
  $$ select my_role, can_add from public.memory_vault(pg_temp.id('vault')) $$,
  $$ values ('family'::text, true) $$,
  'A suggester is family in the vault and can add'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ select * from public.memory_vault(pg_temp.id('vault')) $$,
  'A stranger gets nothing'
);
select is_empty(
  $$ select * from public.memory_vaults $$,
  'nor reads the vault''s row'
);

-- The link -----------------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.create_vault_invite(pg_temp.id('vault')) $$,
  '42501', 'not_allowed',
  'Family cannot make the link'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'token', public.create_vault_invite(pg_temp.id('vault'));
select matches(pg_temp.val('token'), '^[0-9a-f]{32}$', 'The couple gets a link token');
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000b');
select is(
  public.create_vault_invite(pg_temp.id('vault')), pg_temp.val('token'),
  'Asking again hands out the same link, so printed cards keep working'
);
reset role;

set local role anon;
select results_eq(
  $$ select status, vault_id, title, inviter_name, item_count
     from public.vault_invite_preview(pg_temp.val('token')) $$,
  $$ values ('valid'::text, pg_temp.id('vault'), 'Jaspreet & Amrit'::text, 'Asha'::text, 0) $$,
  'Logged out, the link shows the wedding, who shared it and how many photos there are'
);
select is(
  (select jsonb_array_length(events) from public.vault_invite_preview(pg_temp.val('token'))),
  3,
  'and the event names'
);
select ok(
  not exists (
    select 1 from public.vault_invite_preview(pg_temp.val('token')) v, jsonb_array_elements(v.events) e
    where e ? 'date'
  ),
  'but never the event dates'
);
select is(
  (select status from public.vault_invite_preview('0123456789abcdef0123456789abcdef')),
  'not_found',
  'An unknown token is not found'
);
select throws_ok(
  $$ select public.accept_vault_invite(pg_temp.val('token')) $$,
  '42501', null,
  'Logged-out people cannot join'
);
reset role;

-- Joining ------------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select is(public.accept_vault_invite(pg_temp.val('token')), pg_temp.id('vault'), 'Dev joins with the link');
select is(
  public.accept_vault_invite(upper(pg_temp.val('token'))), pg_temp.id('vault'),
  'Joining again is harmless'
);
select results_eq(
  $$ select my_role, can_add from public.memory_vault(pg_temp.id('vault')) $$,
  $$ values ('guest'::text, true) $$,
  'Dev is a guest who can add'
);
select results_eq(
  $$ select id, my_role from public.my_vaults() $$,
  $$ values (pg_temp.id('vault'), 'guest'::text) $$,
  'The vault is in Dev''s list'
);
select is_empty(
  $$ select * from public.weddings where id = pg_temp.id('wedding') $$,
  'A guest still cannot read the wedding plan'
);
select is_empty(
  $$ select * from public.vault_invites $$,
  'or the vault''s links'
);
select pg_temp.as_user('f9000000-0000-4000-8000-00000000000f');
select is(public.accept_vault_invite(pg_temp.val('token')), pg_temp.id('vault'), 'Farah joins too');
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is(
  public.accept_vault_invite(pg_temp.val('token')), pg_temp.id('vault'),
  'The couple scanning their own card just lands in the vault'
);
select is(
  (select guest_count from public.memory_vault(pg_temp.id('vault'))), 2,
  'The couple sees two guests'
);
reset role;
select is(
  (select uses from public.vault_invites where token = pg_temp.val('token')), 2,
  'Only the two guests count as uses of the link'
);

-- Uploading files ----------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg')),
       ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'thumb.jpg')),
       ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '22222222-2222-4222-8222-222222222222', 'video.mp4')) $$,
  'A guest uploads into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('a9000000-0000-4000-8000-00000000000a', '99999999-9999-4999-8999-999999999999', 'photo.jpg')) $$,
  '42501', null,
  'but not into someone else''s'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '99999999-9999-4999-8999-999999999999', 'notes.txt')) $$,
  '42501', null,
  'and only the files an item has'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('e9000000-0000-4000-8000-00000000000e', '99999999-9999-4999-8999-999999999999', 'photo.jpg')) $$,
  '42501', null,
  'A stranger cannot upload to the vault'
);

-- Saving -------------------------------------------------------------------------------

select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '33333333-3333-4333-8333-333333333333', 'photo',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '33333333-3333-4333-8333-333333333333', 'photo.jpg'), 4032, 3024) $$,
  'P0002', 'files_missing',
  'An item needs its files uploaded first'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '11111111-1111-4111-8111-111111111111', 'photo',
       pg_temp.file('a9000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'photo.jpg'), 4032, 3024) $$,
  '22023', 'invalid_file',
  'An item''s files must be in your own folder'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '11111111-1111-4111-8111-111111111111', 'video',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg'), 4032, 3024) $$,
  '22023', 'invalid_file',
  'and named for what it is'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '22222222-2222-4222-8222-222222222222', 'video',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '22222222-2222-4222-8222-222222222222', 'video.mp4'), 1280, 720,
       p_duration_ms => 90000) $$,
  '22023', 'invalid_size',
  'A clip can be a minute at most'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '11111111-1111-4111-8111-111111111111', 'photo',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg'), 4032, 3024,
       p_event_slug => 'walima') $$,
  '22023', 'invalid_event',
  'The event must be one of the wedding''s'
);
select is(
  public.add_vault_item(pg_temp.id('vault'), '11111111-1111-4111-8111-111111111111', 'photo',
    pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg'), 4032, 3024,
    p_thumb_path => pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'thumb.jpg'),
    p_event_slug => 'reception', p_duration_ms => 5000, p_taken_at => '1990-01-01'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Dev saves a photo from the Reception'
);
select results_eq(
  $$ select kind, event_slug, duration_ms, taken_at from public.vault_items
     where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('photo'::text, 'reception'::text, null::integer, null::timestamptz) $$,
  'A photo keeps no length, and an unbelievable time is dropped'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '11111111-1111-4111-8111-111111111111', 'photo',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg'), 4032, 3024) $$,
  '23505', 'already_added',
  'The same item cannot be saved twice'
);
select lives_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '22222222-2222-4222-8222-222222222222', 'video',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '22222222-2222-4222-8222-222222222222', 'video.mp4'), 1280, 720,
       p_event_slug => 'jaago', p_duration_ms => 42000, p_taken_at => now() - interval '1 hour') $$,
  'Dev saves a clip from the Jaago'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '99999999-9999-4999-8999-999999999999', 'photo',
       pg_temp.file('e9000000-0000-4000-8000-00000000000e', '99999999-9999-4999-8999-999999999999', 'photo.jpg'), 10, 10) $$,
  '42501', 'not_allowed',
  'A stranger cannot add to the vault'
);
select pg_temp.as_user('f9000000-0000-4000-8000-00000000000f');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('f9000000-0000-4000-8000-00000000000f', '33333333-3333-4333-8333-333333333333', 'photo.jpg'));
     select public.add_vault_item(pg_temp.id('vault'), '33333333-3333-4333-8333-333333333333', 'photo',
       pg_temp.file('f9000000-0000-4000-8000-00000000000f', '33333333-3333-4333-8333-333333333333', 'photo.jpg'), 3024, 4032) $$,
  'Farah uploads and saves a photo with no event'
);

-- Who sees what ------------------------------------------------------------------------

select set_eq(
  $$ select id from public.vault_items(pg_temp.id('vault')) $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid), ('22222222-2222-4222-8222-222222222222'),
            ('33333333-3333-4333-8333-333333333333') $$,
  'Guests see everyone''s photos by default'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'vault-media'
     and name = pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg')),
  1,
  'and can open their files'
);
select results_eq(
  $$ select added_by_name, is_mine from public.vault_items(pg_temp.id('vault'))
     where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('Dev'::text, false) $$,
  'Each shows the first name of who added it'
);
select set_eq(
  $$ select id from public.vault_items(pg_temp.id('vault'), p_event_slug => 'reception') $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'One event''s photos'
);
select is(
  (select e -> 'count' from public.memory_vault(pg_temp.id('vault')) v, jsonb_array_elements(v.events) e
   where e ->> 'slug' = 'jaago'),
  '1'::jsonb,
  'Each event says how many it has'
);

select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ select * from public.vault_items(pg_temp.id('vault')) $$,
  'A stranger sees no items'
);
select is_empty(
  $$ select * from public.vault_items $$,
  'even reading the table'
);
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'vault-media'), 0,
  'or any of the files'
);

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_guests_see_all => false) $$,
  '42501', 'not_allowed',
  'Family cannot change the settings'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_guests_see_all => false) $$,
  'The couple keeps guests to their own photos'
);
select results_eq(
  $$ select uploads_open, guests_see_all, show_vendors from public.memory_vault(pg_temp.id('vault')) $$,
  $$ values (true, false, true) $$,
  'leaving the other settings as they were'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::integer from public.vault_items(pg_temp.id('vault'))), 3,
  'Family still see everything'
);
select pg_temp.as_user('f9000000-0000-4000-8000-00000000000f');
select set_eq(
  $$ select id from public.vault_items(pg_temp.id('vault')) $$,
  $$ values ('33333333-3333-4333-8333-333333333333'::uuid) $$,
  'Now a guest sees only their own'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'vault-media' and name like pg_temp.id('vault')::text || '/d9%'),
  0,
  'and cannot open anyone else''s files'
);
select results_eq(
  $$ select item_count, my_item_count from public.memory_vault(pg_temp.id('vault')) $$,
  $$ values (1, 1) $$,
  'The counts follow what they see'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_guests_see_all => true) $$,
  'The couple lets guests see everyone''s again'
);
select is(
  (select count(*)::integer from public.vault_items(pg_temp.id('vault'), p_limit => 2)), 2,
  'Items come a page at a time'
);
select is(
  (with page as (
     select created_at, id from public.vault_items(pg_temp.id('vault'), p_limit => 2)
     order by created_at, id
     limit 1
   )
   select count(*)::integer
   from page, public.vault_items(pg_temp.id('vault'), p_before_at => page.created_at, p_before_id => page.id)),
  1,
  'and the next page carries on after the last one'
);

-- Hiding -------------------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.hide_vault_item('11111111-1111-4111-8111-111111111111') $$,
  '42501', 'not_allowed',
  'Family cannot hide a photo'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.hide_vault_item('11111111-1111-4111-8111-111111111111') $$,
  'The couple hides one'
);
select is(
  (select hidden from public.vault_items(pg_temp.id('vault')) where id = '11111111-1111-4111-8111-111111111111'),
  true,
  'The couple still sees it, marked hidden'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select is_empty(
  $$ select 1 from public.vault_items(pg_temp.id('vault')) where id = '11111111-1111-4111-8111-111111111111' $$,
  'Family no longer see it'
);
select pg_temp.as_user('f9000000-0000-4000-8000-00000000000f');
select is_empty(
  $$ select 1 from public.vault_items(pg_temp.id('vault')) where id = '11111111-1111-4111-8111-111111111111' $$,
  'nor do other guests'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'vault-media'
     and name = pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg')),
  0,
  'or its file'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select is(
  (select hidden from public.vault_items(pg_temp.id('vault')) where id = '11111111-1111-4111-8111-111111111111'),
  true,
  'The one who added it still does'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.hide_vault_item('11111111-1111-4111-8111-111111111111', false) $$,
  'and the couple can show it again'
);

-- Locking ------------------------------------------------------------------------------

select lives_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_uploads_open => false) $$,
  'The couple locks the vault'
);
reset role;
-- An upload that finished just before the lock
insert into storage.objects (bucket_id, name) values
  ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '55555555-5555-4555-8555-555555555555', 'photo.jpg'));
set local role authenticated;
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select is(
  (select can_add from public.memory_vault(pg_temp.id('vault'))), false,
  'Guests can no longer add'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '66666666-6666-4666-8666-666666666666', 'photo.jpg')) $$,
  '42501', null,
  'or upload'
);
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '55555555-5555-4555-8555-555555555555', 'photo',
       pg_temp.file('d9000000-0000-4000-8000-00000000000d', '55555555-5555-4555-8555-555555555555', 'photo.jpg'), 10, 10) $$,
  'P0001', 'uploads_locked',
  'and saving says the vault is locked'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('vault-media', pg_temp.file('a9000000-0000-4000-8000-00000000000a', '44444444-4444-4444-8444-444444444444', 'photo.jpg'));
     select public.add_vault_item(pg_temp.id('vault'), '44444444-4444-4444-8444-444444444444', 'photo',
       pg_temp.file('a9000000-0000-4000-8000-00000000000a', '44444444-4444-4444-8444-444444444444', 'photo.jpg'), 10, 10) $$,
  'The couple can still upload and save'
);

-- Removing -----------------------------------------------------------------------------

select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select ok(
  private.can_delete_vault_object(
    pg_temp.file('d9000000-0000-4000-8000-00000000000d', '55555555-5555-4555-8555-555555555555', 'photo.jpg')),
  'A person may delete their own upload that was never saved'
);
select ok(
  not private.can_delete_vault_object(
    pg_temp.file('d9000000-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'photo.jpg')),
  'but not the files of a saved item'
);
select ok(
  not private.can_delete_vault_object(
    pg_temp.file('f9000000-0000-4000-8000-00000000000f', '33333333-3333-4333-8333-333333333333', 'photo.jpg')),
  'nor anyone else''s'
);
select pg_temp.as_user('f9000000-0000-4000-8000-00000000000f');
select throws_ok(
  $$ select public.remove_vault_item('11111111-1111-4111-8111-111111111111') $$,
  '42501', 'not_allowed',
  'A guest cannot delete someone else''s photo'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select lives_ok(
  $$ select public.remove_vault_item('22222222-2222-4222-8222-222222222222') $$,
  'Dev deletes his own clip'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.remove_vault_item('33333333-3333-4333-8333-333333333333') $$,
  'The couple deletes Farah''s photo'
);
select set_eq(
  $$ select id from public.vault_items(pg_temp.id('vault')) $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid), ('44444444-4444-4444-8444-444444444444') $$,
  'Both are gone'
);

-- The vendors who made this day --------------------------------------------------------

reset role;
insert into public.vendors (id, slug, status, name, city, location) values
  ('99000000-0000-4000-8000-000000000001', 'vault-test-dhol', 'published', 'Test Dhol Crew', 'Yuba City',
   'SRID=4326;POINT(-121.61 39.14)'),
  ('99000000-0000-4000-8000-000000000002', 'vault-test-draft', 'draft', 'Draft Caterer', 'Yuba City',
   'SRID=4326;POINT(-121.61 39.14)');
insert into public.wedding_bookings (wedding_id, event_slug, category_slug, vendor_id) values
  (pg_temp.id('wedding'), 'jaago', 'dhol', '99000000-0000-4000-8000-000000000001'),
  (pg_temp.id('wedding'), 'reception', 'caterer', '99000000-0000-4000-8000-000000000002');
set local role authenticated;

select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select results_eq(
  $$ select slug, category_slugs, event_slugs from public.vault_vendors(pg_temp.id('vault')) $$,
  $$ values ('vault-test-dhol'::text, array['dhol']::text[], array['jaago']::text[]) $$,
  'Guests see the published vendors the family booked'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_show_vendors => false) $$,
  'The couple hides them from guests'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select is_empty(
  $$ select * from public.vault_vendors(pg_temp.id('vault')) $$,
  'Then guests see none'
);
select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::integer from public.vault_vendors(pg_temp.id('vault'))), 1,
  'while family still do'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ select * from public.vault_vendors(pg_temp.id('vault')) $$,
  'Strangers never do'
);

-- Leaving ------------------------------------------------------------------------------

select pg_temp.as_user('c9000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.remove_vault_guest(pg_temp.id('vault'), 'f9000000-0000-4000-8000-00000000000f') $$,
  '42501', 'not_allowed',
  'Family cannot remove a guest'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.remove_vault_guest(pg_temp.id('vault'), 'f9000000-0000-4000-8000-00000000000f') $$,
  'The couple removes Farah'
);
select pg_temp.as_user('d9000000-0000-4000-8000-00000000000d');
select lives_ok(
  $$ select public.remove_vault_guest(pg_temp.id('vault'), 'd9000000-0000-4000-8000-00000000000d') $$,
  'Dev leaves'
);
select is_empty(
  $$ select * from public.vault_items(pg_temp.id('vault')) $$,
  'and no longer sees the vault'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::integer from public.vault_items(pg_temp.id('vault'))
   where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'What he added stays for the couple'
);

-- Stopping the link --------------------------------------------------------------------

select lives_ok(
  $$ select public.revoke_vault_invite(pg_temp.id('vault')) $$,
  'The couple stops the link'
);
select results_eq(
  $$ select status, title from public.vault_invite_preview(pg_temp.val('token')) $$,
  $$ values ('revoked'::text, null::text) $$,
  'A stopped link shows nothing but that'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.accept_vault_invite(pg_temp.val('token')) $$,
  'P0001', 'invite_revoked',
  'and nobody new can join with it'
);
select pg_temp.as_user('a9000000-0000-4000-8000-00000000000a');
insert into pg_temp.ids select 'token2', public.create_vault_invite(pg_temp.id('vault'));
select isnt(pg_temp.val('token2'), pg_temp.val('token'), 'The next link is a new one');

-- Limits -------------------------------------------------------------------------------

select lives_ok(
  $$ select public.set_vault_settings(pg_temp.id('vault'), p_uploads_open => true) $$,
  'The couple opens uploads again'
);
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select is(public.accept_vault_invite(pg_temp.val('token2')), pg_temp.id('vault'), 'Esha joins with the new link');
reset role;
insert into public.vault_items (id, vault_id, user_id, kind, path, width, height)
select gen_random_uuid(), pg_temp.id('vault'), 'e9000000-0000-4000-8000-00000000000e', 'photo', 'esha-' || n, 10, 10
from generate_series(1, 300) as n;
insert into storage.objects (bucket_id, name) values
  ('vault-media', pg_temp.file('e9000000-0000-4000-8000-00000000000e', '66666666-6666-4666-8666-666666666666', 'photo.jpg'));
set local role authenticated;
select pg_temp.as_user('e9000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ select public.add_vault_item(pg_temp.id('vault'), '66666666-6666-4666-8666-666666666666', 'photo',
       pg_temp.file('e9000000-0000-4000-8000-00000000000e', '66666666-6666-4666-8666-666666666666', 'photo.jpg'), 10, 10) $$,
  'P0001', 'too_many_items',
  'A guest can add up to 300'
);

-- Clearing files -----------------------------------------------------------------------

select throws_ok(
  $$ select * from public.orphan_vault_files() $$,
  '42501', null,
  'Only the server lists files to clear'
);
reset role;
-- Everything uploaded so far is over an hour old; one more upload is still fresh
update storage.objects set created_at = now() - interval '2 hours' where bucket_id = 'vault-media';
insert into storage.objects (bucket_id, name) values
  ('vault-media', pg_temp.file('d9000000-0000-4000-8000-00000000000d', '77777777-7777-4777-8777-777777777777', 'photo.jpg'));
set local role service_role;
select set_eq(
  $$ select name from public.orphan_vault_files() $$,
  $$ values
       (pg_temp.file('d9000000-0000-4000-8000-00000000000d', '22222222-2222-4222-8222-222222222222', 'video.mp4')),
       (pg_temp.file('f9000000-0000-4000-8000-00000000000f', '33333333-3333-4333-8333-333333333333', 'photo.jpg')),
       (pg_temp.file('d9000000-0000-4000-8000-00000000000d', '55555555-5555-4555-8555-555555555555', 'photo.jpg')),
       (pg_temp.file('e9000000-0000-4000-8000-00000000000e', '66666666-6666-4666-8666-666666666666', 'photo.jpg')) $$,
  'Files of deleted items and unsaved uploads are cleared; saved items'' files and fresh uploads stay'
);
reset role;

-- Deleting -----------------------------------------------------------------------------

delete from auth.users where id = 'd9000000-0000-4000-8000-00000000000d';
select is(
  (select count(*)::integer from public.vault_items where user_id = 'd9000000-0000-4000-8000-00000000000d'),
  0,
  'Deleting an account deletes what that person added'
);
delete from public.weddings where id = pg_temp.id('wedding');
select is(
  (select count(*)::integer from public.memory_vaults where id = pg_temp.id('vault')),
  0,
  'Deleting the wedding deletes its vault'
);
select is(
  (select count(*)::integer from public.vault_items where vault_id = pg_temp.id('vault')),
  0,
  'and everything in it'
);

select * from finish();
rollback;
