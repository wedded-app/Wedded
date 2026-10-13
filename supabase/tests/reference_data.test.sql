-- Reference data: completeness, the rules from the product vision, and what
-- the app's roles (anon = logged out, authenticated = signed in) can do.
-- Run with `npm run db:test` (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Security ----------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'Every table in public has row level security enabled'
);

-- Completeness ------------------------------------------------------------

select is(
  (select count(*)::int from public.cultures where is_default),
  1,
  'Exactly one default culture'
);

select is(
  (select count(*)::int from public.culture_events where culture_slug = 'punjabi-sikh'),
  19,
  'Punjabi Sikh has 18 events plus the Whole wedding card'
);

select is(
  (select count(*)::int from public.categories),
  64,
  'All 64 vendor categories from the taxonomy are present'
);

select is(
  (
    select count(*)::int
    from public.events e
    join public.culture_events ce on ce.event_slug = e.slug
    join public.cultures c on c.slug = ce.culture_slug
    where c.is_default and not (e.name ? 'pa')
  ),
  0,
  'Every event of the default culture has a Punjabi name (the November demo flips Home to Punjabi)'
);

select is(
  (select count(*)::int from public.cultures),
  6,
  'Six traditions: Punjabi Sikh, Punjabi Hindu, Pakistani, Muslim, Arab and Christian'
);

select results_eq(
  $$ select name ->> 'en' from public.backgrounds order by sort_order $$,
  $$ values ('Punjab'), ('Pakistan'), ('India'), ('Middle East'), ('Afghanistan'), ('Bangladesh') $$,
  'Six places the families can be from, named as places rather than nationalities'
);

select is(
  (select count(*)::int from public.faiths),
  4,
  'Four faiths to pick from: Sikh, Hindu, Muslim and Christian'
);

select is(
  (select count(*)::int from public.cultures where background_slug is null and faith_slug is null),
  0,
  'Every tradition belongs to a background, a faith or both, so the first questions can find it'
);

select is(
  (
    select count(*)::int
    from public.faiths f
    where not exists (select 1 from public.cultures c where c.faith_slug = f.slug)
  ),
  0,
  'Every faith has a tradition, so each faith in the first questions leads to events'
);

select results_eq(
  $$ select background_slug, faith_slug from public.cultures where is_default $$,
  $$ values ('punjabi'::text, 'sikh'::text) $$,
  'The default tradition is Punjabi and Sikh'
);

select is(
  (
    select count(*)::int
    from public.cultures c
    where not exists (
      select 1 from public.culture_events ce
      where ce.culture_slug = c.slug and ce.event_slug = 'whole-wedding' and ce.phase = 'whole_wedding'
    )
  ),
  0,
  'Every tradition ends with the Whole wedding card'
);

select is(
  (
    select count(*)::int
    from public.cultures c
    where not exists (
      select 1 from public.culture_events ce
      where ce.culture_slug = c.slug and ce.is_core and ce.phase <> 'whole_wedding'
    )
  ),
  0,
  'Every tradition has main events for My Wedding to show first'
);

select is(
  (
    select count(*)::int
    from public.events e
    where not exists (
      select 1 from public.event_categories ec
      where ec.event_slug = e.slug and ec.importance = 'essential'
    )
  ),
  0,
  'Every event lists at least one essential vendor category'
);

select results_eq(
  $$ select phase from public.culture_events
     where culture_slug = 'punjabi-sikh' and event_slug = 'whole-wedding' $$,
  array['whole_wedding'],
  'Whole wedding is its own card at the end of Home'
);

-- Rules from the product vision ----------------------------------------------

select set_eq(
  $$ select ec.event_slug
     from public.event_categories ec
     join public.categories c on c.slug = ec.category_slug
     where c.serves_alcohol $$,
  array['jaago', 'reception'],
  'Alcohol categories appear only under jaago and reception'
);

select is(
  (
    select count(*)::int
    from public.categories
    where is_religious and slug not in (
      'gurdwara', 'mandir-masjid', 'ragi-jatha', 'paathi', 'granthi',
      'pandit', 'imam', 'bhajan-mandali'
    )
  ),
  0,
  'Only places of worship and religious services are marked religious'
);

select is(
  (
    select count(*)::int
    from public.event_categories ec
    join public.categories c on c.slug = ec.category_slug
    where ec.event_slug = 'whole-wedding' and c.is_religious
  ),
  0,
  'Whole wedding, shared by every tradition, lists no religious services'
);

-- Data rules the database enforces -------------------------------------------

select throws_ok(
  $$ insert into public.category_groups (slug, name, sort_order) values ('test', '{"pa": "x"}', 99) $$,
  '23514',
  null,
  'A name without English is rejected'
);

select throws_ok(
  $$ insert into public.category_groups (slug, name, sort_order) values ('Not A Slug', '{"en": "Test"}', 99) $$,
  '23514',
  null,
  'A slug that is not lowercase-with-dashes is rejected'
);

select throws_ok(
  $$ insert into public.events (slug, name, host_side, typical_guests_min, typical_guests_max)
     values ('test', '{"en": "Test"}', 'joint', 200, 100) $$,
  '23514',
  null,
  'A guest range with max below min is rejected'
);

select throws_ok(
  $$ update public.culture_events set local_name = '{"pa": "x"}' where event_slug = 'mehndi' $$,
  '23514',
  null,
  'A tradition''s own name for an event needs English too'
);

-- What the app can do --------------------------------------------------------

set local role anon;

select is(
  (select count(*)::int from public.events),
  25,
  'Logged-out users can read events'
);

select throws_ok(
  $$ insert into public.events (slug, name, host_side) values ('test', '{"en": "Test"}', 'joint') $$,
  '42501',
  null,
  'Logged-out users cannot add events'
);

select throws_ok(
  $$ update public.categories set aliases = '{}' $$,
  '42501',
  null,
  'Logged-out users cannot change categories'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ delete from public.event_categories $$,
  '42501',
  null,
  'Signed-in users cannot delete what an event needs'
);

reset role;

select * from finish();
rollback;
