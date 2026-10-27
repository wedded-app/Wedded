-- A draft website's link follows the couple's names (#411): a site made
-- before the names were in has the placeholder our-wedding, and takes a link
-- made from the names when they come in. A published site and a link the
-- family picked keep theirs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- People: Asha plans five weddings with no names yet; Mehar plans one
insert into auth.users (id, instance_id, aud, role, email) values
  ('a9100000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha-n@example.com'),
  ('b9100000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mehar-n@example.com');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create table pg_temp.ids (name text primary key, value text);
grant all on pg_temp.ids to authenticated, anon;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select value::uuid from pg_temp.ids where name = p_name;
$$;
create function pg_temp.slug(p_name text) returns text language sql as $$
  select s.slug from public.wedding_sites s where s.wedding_id = pg_temp.id(p_name);
$$;
create function pg_temp.rename(p_name text, p_title text) returns void language sql as $$
  update public.weddings set title = p_title where id = pg_temp.id(p_name);
$$;

set local role authenticated;

-- Mehar & Dev Test's site has the link mehar-dev-test
select pg_temp.as_user('b9100000-0000-4000-8000-00000000000b');
insert into pg_temp.ids
select 'mehar', public.create_wedding(p_title => 'Mehar & Dev Test', p_events => array['reception'])::text;
select public.create_site(pg_temp.id('mehar'));

-- Asha opens Website for each wedding before adding the names
select pg_temp.as_user('a9100000-0000-4000-8000-00000000000a');
insert into pg_temp.ids
select name, public.create_wedding(p_events => array['reception'])::text
from unnest(array['draft', 'published', 'chosen', 'clash', 'short']) as name;
select public.create_site(pg_temp.id(name))
from unnest(array['draft', 'published', 'chosen', 'clash', 'short']) as name;

select ok(
  pg_temp.slug('draft') ~ '^our-wedding(-[0-9a-f]{4})?$',
  'A site made before the names has the placeholder link'
);

select pg_temp.rename('draft', 'Noorpreet & Kabirjot');
select is(pg_temp.slug('draft'), 'noorpreet-kabirjot', 'The couple''s names give the draft its link');

select pg_temp.rename('draft', 'Noorpreet & Kabirjot Singh');
select is(pg_temp.slug('draft'), 'noorpreet-kabirjot', 'Changing the names again keeps the link it has');

select public.publish_site(pg_temp.id('published'), true);
insert into pg_temp.ids select 'published_slug', pg_temp.slug('published');
select pg_temp.rename('published', 'Simran & Arjun Test');
select is(
  pg_temp.slug('published'), (select value from pg_temp.ids where name = 'published_slug'),
  'A published site keeps its link, which may already be out'
);

select public.set_site_slug(pg_temp.id('chosen'), 'our-big-day-test');
select pg_temp.rename('chosen', 'Harleen & Manvir Test');
select is(pg_temp.slug('chosen'), 'our-big-day-test', 'A link the family picked stays');

select pg_temp.rename('clash', 'Mehar & Dev Test');
select ok(
  pg_temp.slug('clash') ~ '^mehar-dev-test-[0-9a-f]{4}$',
  'A link another wedding has gets four letters after it'
);

insert into pg_temp.ids select 'short_slug', pg_temp.slug('short');
select pg_temp.rename('short', 'J');
select is(
  pg_temp.slug('short'), (select value from pg_temp.ids where name = 'short_slug'),
  'A name too short for a link keeps the placeholder'
);
select pg_temp.rename('short', 'ਕਿਰਤ ਤੇ ਸਿਮਰ');
select is(
  pg_temp.slug('short'), (select value from pg_temp.ids where name = 'short_slug'),
  'Names with no Latin letters keep the placeholder'
);

select * from finish();
rollback;
