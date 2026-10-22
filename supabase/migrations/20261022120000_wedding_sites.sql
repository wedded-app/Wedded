-- Wedding websites (Fezy, 2026-10-22, after The Knot's Website tab): one page
-- a family shares with a link, at /w/{slug}. It fills itself from the plan
-- (the couple's names, each event's day, time and place), and a guest who
-- opens it with their own RSVP link sees only the events they're invited to.
-- The family picks a design and a cover photo, writes the parts they want
-- (family names, their story, a guide to the ceremony, hotels, questions) and
-- publishes it. Until then only the wedding's own people can see it. A
-- password is optional, and the page stays out of search engines unless the
-- family turns that on. Modelled on the design's credits_pages: one row per
-- wedding with its own slug and published_at.

create extension if not exists pgcrypto with schema extensions;

-- Helpers ------------------------------------------------------------------------------

-- Every line is trimmed text of 1 to p_max characters.
create function private.are_short_lines(p_lines text[], p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(length(l) between 1 and p_max and l = btrim(l)), true)
  from unnest(p_lines) as l;
$$;

-- Colours as #RRGGBB, upper case.
create function private.are_hex_colors(p_colors text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(c ~ '^#[0-9A-F]{6}$'), true) from unnest(p_colors) as c;
$$;

-- The parts of a site under its cover, each at most once.
create function private.is_site_sections(p_sections text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_sections <@ array['family', 'story', 'events', 'rsvp', 'guide', 'travel', 'livestream', 'faq']
    and cardinality(p_sections) = (select count(distinct s) from unnest(p_sections) as s);
$$;

-- A JSON array of strings as trimmed text, dropping blanks.
create function private.clean_lines(p_lines jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(btrim(t.l) order by t.n), '{}')
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end
  ) with ordinality as t(l, n)
  where btrim(t.l) <> '';
$$;

-- Tables -------------------------------------------------------------------------------

create table public.wedding_sites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null unique references public.weddings (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  design text not null default 'classic'
    check (design ~ '^[a-z]+(-[a-z]+)*$' and length(design) <= 30),
  palette text check (palette ~ '^[a-z]+(-[a-z]+)*$' and length(palette) <= 30),
  cover_path text,
  welcome text check (length(welcome) between 1 and 300 and welcome = btrim(welcome)),
  story text check (length(story) between 1 and 3000 and story = btrim(story)),
  family_title text
    check (length(family_title) between 1 and 60 and family_title = btrim(family_title)),
  family_lines text[] not null default '{}'
    check (cardinality(family_lines) <= 4 and private.are_short_lines(family_lines, 120)),
  guide_title text check (length(guide_title) between 1 and 60 and guide_title = btrim(guide_title)),
  livestream_url text check (livestream_url ~ '^https://\S+$' and length(livestream_url) <= 500),
  livestream_note text
    check (length(livestream_note) between 1 and 200 and livestream_note = btrim(livestream_note)),
  rsvp_by date,
  sections text[] not null
    default array['family', 'story', 'events', 'rsvp', 'guide', 'travel', 'livestream', 'faq']
    check (private.is_site_sections(sections)),
  searchable boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_sites_cover_in_wedding check (cover_path like wedding_id::text || '/%')
);

comment on table public.wedding_sites is
  'A wedding''s website (/w/{slug}): its design, cover photo and the parts the family wrote. Members read it; owners and editors change it through the site functions; guests read it with site_page() once it''s published.';
comment on column public.wedding_sites.design is
  'The design''s id in the app (classic, heirloom, palace, marigold, noor, mehndi); the app shows classic for one it doesn''t know.';
comment on column public.wedding_sites.palette is
  'One of the design''s colour sets; null is the design''s first.';
comment on column public.wedding_sites.cover_path is
  'The cover photo''s folder in the site-media bucket: <wedding id>/<photo id>, with 400, 1080 and 1600 .webp inside.';
comment on column public.wedding_sites.family_lines is
  'Up to four lines under family_title ("With the blessings of"), usually the parents of each side.';
comment on column public.wedding_sites.guide_title is
  'The heading over the guide''s tips ("At the gurdwara"); the app says "Good to know" when null.';
comment on column public.wedding_sites.sections is
  'The parts guests see under the cover, in order. A part that''s missing is switched off; one that''s here but empty isn''t shown.';
comment on column public.wedding_sites.searchable is
  'Whether search engines may list the page. Off by default.';
comment on column public.wedding_sites.published_at is
  'When the family published the site; null while it''s a draft only they can see.';

create trigger set_updated_at before update on public.wedding_sites
  for each row execute function private.set_updated_at();

create table public.wedding_site_locks (
  site_id uuid primary key references public.wedding_sites (id) on delete cascade,
  password_hash text,
  miss_day date,
  misses integer not null default 0 check (misses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wedding_site_locks is
  'A wedding site''s password (bcrypt of the lower-cased password) and wrong tries today. Server side only: set_site_password() writes it and site_page() checks it, stopping at 30 wrong tries a day.';

create trigger set_updated_at before update on public.wedding_site_locks
  for each row execute function private.set_updated_at();

create table public.wedding_site_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites (id) on delete cascade,
  kind text not null check (kind in ('tip', 'hotel', 'faq')),
  position smallint not null check (position between 1 and 20),
  title text not null check (length(title) between 1 and 200 and title = btrim(title)),
  body text check (length(body) between 1 and 1000 and body = btrim(body)),
  link text check (link ~ '^https://\S+$' and length(link) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_site_items_order_key unique (site_id, kind, position)
);

comment on table public.wedding_site_items is
  'The lists on a wedding site, in order: tips (the guide), hotels (name, note with the group code, booking link) and faq (question, answer). Written only by set_site_items().';

create trigger set_updated_at before update on public.wedding_site_items
  for each row execute function private.set_updated_at();

-- What guests should know before an event, for the family to start from.
create table public.event_guest_tips (
  event_slug text not null references public.events (slug) on update cascade on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 20),
  tip jsonb not null check (private.is_localized_text(tip)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_slug, sort_order)
);

comment on table public.event_guest_tips is
  'Suggestions of what guests should know before an event (cover your head, shoes off...). A family adds them to their wedding site''s guide and changes them there.';

create trigger set_updated_at before update on public.event_guest_tips
  for each row execute function private.set_updated_at();

insert into public.event_guest_tips (event_slug, sort_order, tip) values
  ('anand-karaj', 1, '{"en": "Please cover your head inside the gurdwara. Scarves are usually at the door."}'),
  ('anand-karaj', 2, '{"en": "Shoes come off before you go in."}'),
  ('anand-karaj', 3, '{"en": "Everyone sits on the floor in the prayer hall. There are chairs for anyone who needs one."}'),
  ('anand-karaj', 4, '{"en": "Please don''t bring alcohol or tobacco onto the gurdwara grounds."}'),
  ('anand-karaj', 5, '{"en": "Langar, a meal for everyone, is served after the ceremony."}'),
  ('akhand-paath', 1, '{"en": "Please cover your head inside the gurdwara. Scarves are usually at the door."}'),
  ('akhand-paath', 2, '{"en": "Shoes come off before you go in."}'),
  ('akhand-paath', 3, '{"en": "You can come and go quietly during the reading."}'),
  ('nikah', 1, '{"en": "Modest clothing is appreciated, with shoulders and knees covered."}'),
  ('nikah', 2, '{"en": "Women may like to bring a scarf to cover their hair."}'),
  ('nikah', 3, '{"en": "Men and women may sit in separate areas."}'),
  ('nikah', 4, '{"en": "The ceremony is short, so please arrive on time."}'),
  ('pheras', 1, '{"en": "The ceremony around the sacred fire takes about an hour."}'),
  ('pheras', 2, '{"en": "Shoes come off near the mandap."}'),
  ('pheras', 3, '{"en": "Bright colours are welcome. Please avoid all white."}'),
  ('church-wedding', 1, '{"en": "Please arrive 15 minutes early so the ceremony can start on time."}'),
  ('church-wedding', 2, '{"en": "Phones on silent during the service, please."}');

-- Each event's details for guests
alter table public.wedding_events
  add column dress_code text
    check (length(dress_code) between 1 and 200 and dress_code = btrim(dress_code)),
  add column dress_colors text[] not null default '{}'
    check (cardinality(dress_colors) <= 3 and private.are_hex_colors(dress_colors)),
  add column guest_note text
    check (length(guest_note) between 1 and 300 and guest_note = btrim(guest_note)),
  add column shown_publicly boolean not null default true;

comment on column public.wedding_events.dress_code is
  'What guests should wear, on the wedding site ("Wear yellow").';
comment on column public.wedding_events.dress_colors is
  'Up to three colours for the dress code, shown as swatches (#RRGGBB).';
comment on column public.wedding_events.guest_note is
  'A short note for guests on the wedding site ("Langar after the ceremony").';
comment on column public.wedding_events.shown_publicly is
  'Whether the event shows on the wedding site to everyone. When false, only guests invited to it see it, on their own link.';

-- Access -------------------------------------------------------------------------------

alter table public.wedding_sites enable row level security;
alter table public.wedding_site_locks enable row level security;
alter table public.wedding_site_items enable row level security;
alter table public.event_guest_tips enable row level security;

create policy "Members read their wedding's site" on public.wedding_sites
  for select to authenticated
  using (private.wedding_role(wedding_id) is not null);

create policy "Members read their wedding's site lists" on public.wedding_site_items
  for select to authenticated
  using (exists (
    select 1 from public.wedding_sites s
    where s.id = wedding_site_items.site_id and private.wedding_role(s.wedding_id) is not null
  ));

create policy "Reference data is readable by everyone" on public.event_guest_tips
  for select to anon, authenticated using (true);

revoke all on public.wedding_sites, public.wedding_site_locks, public.wedding_site_items,
  public.event_guest_tips
  from anon, authenticated;
grant select on public.wedding_sites, public.wedding_site_items to authenticated;
grant select on public.event_guest_tips to anon, authenticated;

create index wedding_site_items_site_idx on public.wedding_site_items (site_id, kind, position);

-- Files --------------------------------------------------------------------------------

-- Cover photos are public like vendor photos: a password keeps the page private,
-- and the photo's address can't be guessed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5 * 1024 * 1024, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- <wedding id>/<photo id>/(400|1080|1600).webp in a wedding the caller edits.
-- Deleting also needs the photo not to be the cover now.
create function private.can_write_site_file(p_name text, p_deleting boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_name ~ ('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                   || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(400|1080|1600)\.webp$')
      then private.can_edit_wedding(split_part(p_name, '/', 1)::uuid)
        and not (p_deleting and exists (
          select 1 from public.wedding_sites s
          where s.cover_path = split_part(p_name, '/', 1) || '/' || split_part(p_name, '/', 2)
        ))
    else false
  end;
$$;

revoke all on function private.can_write_site_file from public;
grant execute on function private.can_write_site_file to authenticated;

create policy "Owners and editors upload their wedding site's photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and private.can_write_site_file(name, false));
create policy "Owners and editors delete their wedding site's old photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and private.can_write_site_file(name, true));

-- Functions (security definer in private, invoker wrappers in public) ------------------

-- Make the wedding's site, named from the couple ("Asha & Ravi" is asha-ravi,
-- or asha-ravi-3f9c when that's taken). Making it again returns it.
create function private.create_site(p_wedding_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing text;
  base text;
  candidate text;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select s.slug into existing from public.wedding_sites s where s.wedding_id = p_wedding_id;
  if found then
    return existing;
  end if;
  select left(btrim(regexp_replace(lower(w.title), '[^a-z0-9]+', '-', 'g'), '-'), 32)
  into base
  from public.weddings w where w.id = p_wedding_id;
  base := btrim(coalesce(base, ''), '-');
  if length(base) < 3 then
    base := 'our-wedding';
  end if;
  for tries in 0..5 loop
    candidate := case when tries = 0 then base else base || '-' || substr(md5(random()::text), 1, 4) end;
    begin
      insert into public.wedding_sites (wedding_id, slug) values (p_wedding_id, candidate);
      return candidate;
    exception when unique_violation then
      -- Someone made this wedding's site at the same moment, or the name is taken
      select s.slug into existing from public.wedding_sites s where s.wedding_id = p_wedding_id;
      if found then
        return existing;
      end if;
    end;
  end loop;
  raise exception 'slug_taken' using errcode = '23505';
end;
$$;

create function public.create_site(p_wedding_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.create_site(p_wedding_id);
$$;

comment on function public.create_site is
  'Owner and editors: make the wedding''s website (a draft) named from the couple, or return the one it has. Returns its slug. Errors: not_allowed, slug_taken (six names in a row taken).';

-- The site as a guest sees it, logged out. A guest's own RSVP token shows
-- only the events they're invited to (all public ones when they have no
-- invites yet) and skips the password. The wedding's own people see drafts
-- and every event, with an "editor" part for the builder.
create function private.site_page(p_slug text, p_password text, p_guest_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.wedding_sites;
  wed public.weddings;
  member_role text;
  guest public.wedding_guests;
  site_lock public.wedding_site_locks;
  invited integer := 0;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  event_list jsonb;
  lists jsonb;
begin
  select * into site from public.wedding_sites s where s.slug = lower(btrim(coalesce(p_slug, '')));
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  member_role := private.wedding_role(site.wedding_id);
  if site.published_at is null and member_role is null then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  select * into wed from public.weddings w where w.id = site.wedding_id;

  if coalesce(btrim(p_guest_token), '') <> '' then
    select * into guest from public.wedding_guests g
    where g.rsvp_token = lower(btrim(p_guest_token)) and g.wedding_id = site.wedding_id;
  end if;

  if member_role is null and guest.id is null then
    select * into site_lock from public.wedding_site_locks l where l.site_id = site.id;
    if site_lock.password_hash is not null then
      if coalesce(btrim(p_password), '') = '' then
        return jsonb_build_object('locked', 'password_required', 'title', wed.title,
          'design', site.design, 'palette', site.palette);
      end if;
      if site_lock.miss_day = today and site_lock.misses >= 30 then
        raise exception 'password_limit' using errcode = 'P0001';
      end if;
      if extensions.crypt(lower(btrim(p_password)), site_lock.password_hash) <> site_lock.password_hash then
        update public.wedding_site_locks l
        set misses = case when l.miss_day = today then l.misses + 1 else 1 end, miss_day = today
        where l.site_id = site.id;
        return jsonb_build_object('locked', 'wrong_password', 'title', wed.title,
          'design', site.design, 'palette', site.palette);
      end if;
    end if;
  end if;

  if guest.id is not null then
    select count(*) into invited from public.guest_invites i where i.guest_id = guest.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', e.event_slug,
      'date', e.event_date,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      -- A listed hall or gurdwara by its name, else what the family typed
      'place', coalesce(v.name, e.venue_text),
      'city', c.name,
      'dress_code', e.dress_code,
      'dress_colors', to_jsonb(e.dress_colors),
      'note', e.guest_note,
      'shown_publicly', e.shown_publicly,
      'rsvp', i.rsvp,
      'coming', i.coming
    ) order by e.event_date nulls last, e.starts_at nulls last, e.event_slug), '[]'::jsonb)
  into event_list
  from public.wedding_events e
  left join public.vendors v on v.id = e.venue_id
  left join public.cities c on c.slug = e.city_slug
  left join public.guest_invites i on i.wedding_event_id = e.id and i.guest_id = guest.id
  where e.wedding_id = site.wedding_id
    and case
      when invited > 0 then i.guest_id is not null
      when guest.id is null and member_role is not null then true
      else e.shown_publicly
    end;

  select coalesce(jsonb_object_agg(k.kind, k.list), '{}'::jsonb)
  into lists
  from (
    select it.kind,
      jsonb_agg(jsonb_build_object('title', it.title, 'body', it.body, 'link', it.link)
        order by it.position) as list
    from public.wedding_site_items it
    where it.site_id = site.id
    group by it.kind
  ) k;

  return jsonb_build_object(
    'slug', site.slug,
    'title', wed.title,
    'wedding_date', wed.wedding_date,
    'design', site.design,
    'palette', site.palette,
    'cover_path', site.cover_path,
    'welcome', site.welcome,
    'story', site.story,
    'family_title', site.family_title,
    'family_lines', to_jsonb(site.family_lines),
    'guide_title', site.guide_title,
    'livestream_url', site.livestream_url,
    'livestream_note', site.livestream_note,
    'rsvp_by', site.rsvp_by,
    'sections', to_jsonb(site.sections),
    'searchable', site.searchable,
    'published_at', site.published_at,
    -- The wedding's shared RSVP link, for "Find your invitation"
    'rsvp_link', wed.rsvp_token,
    'guest', case when guest.id is null then null else jsonb_build_object(
      'name', guest.name, 'party_size', guest.party_size, 'token', guest.rsvp_token) end,
    'events', event_list,
    'tips', coalesce(lists -> 'tip', '[]'::jsonb),
    'hotels', coalesce(lists -> 'hotel', '[]'::jsonb),
    'faq', coalesce(lists -> 'faq', '[]'::jsonb),
    'editor', case when member_role is null then null else jsonb_build_object(
      'wedding_id', site.wedding_id,
      'role', member_role,
      'can_edit', member_role in ('owner', 'editor'),
      'has_password', exists (
        select 1 from public.wedding_site_locks l
        where l.site_id = site.id and l.password_hash is not null)) end
  );
end;
$$;

create function public.site_page(
  p_slug text, p_password text default null, p_guest_token text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.site_page(p_slug, p_password, p_guest_token);
$$;

comment on function public.site_page is
  'A wedding website, logged out: the couple, design, cover, the parts the family wrote and the events the reader may see. With a guest''s RSVP token, only their events. {"locked": "password_required" | "wrong_password", "title", "design", "palette"} when it needs the password. Members also see drafts, every event and "editor". Errors: site_not_found, password_limit (30 wrong tries a day).';

-- Change the site's settings and words. Only the keys given change; null or
-- "" clears one. Text is trimmed.
create function private.update_site(p_wedding_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k <> all (array['design', 'palette', 'welcome', 'story', 'family_title', 'family_lines',
        'guide_title', 'livestream_url', 'livestream_note', 'rsvp_by', 'sections', 'searchable']) then
      raise exception 'invalid_field' using errcode = '22023', detail = k;
    end if;
  end loop;
  update public.wedding_sites s set
    design = case when p_changes ? 'design'
      then coalesce(nullif(btrim(p_changes ->> 'design'), ''), 'classic') else s.design end,
    palette = case when p_changes ? 'palette'
      then nullif(btrim(p_changes ->> 'palette'), '') else s.palette end,
    welcome = case when p_changes ? 'welcome'
      then nullif(btrim(p_changes ->> 'welcome'), '') else s.welcome end,
    story = case when p_changes ? 'story'
      then nullif(btrim(p_changes ->> 'story'), '') else s.story end,
    family_title = case when p_changes ? 'family_title'
      then nullif(btrim(p_changes ->> 'family_title'), '') else s.family_title end,
    family_lines = case when p_changes ? 'family_lines'
      then private.clean_lines(p_changes -> 'family_lines') else s.family_lines end,
    guide_title = case when p_changes ? 'guide_title'
      then nullif(btrim(p_changes ->> 'guide_title'), '') else s.guide_title end,
    livestream_url = case when p_changes ? 'livestream_url'
      then nullif(btrim(p_changes ->> 'livestream_url'), '') else s.livestream_url end,
    livestream_note = case when p_changes ? 'livestream_note'
      then nullif(btrim(p_changes ->> 'livestream_note'), '') else s.livestream_note end,
    rsvp_by = case when p_changes ? 'rsvp_by'
      then nullif(btrim(p_changes ->> 'rsvp_by'), '')::date else s.rsvp_by end,
    sections = case when p_changes ? 'sections'
      then private.clean_lines(p_changes -> 'sections') else s.sections end,
    searchable = case when p_changes ? 'searchable'
      then coalesce((p_changes ->> 'searchable')::boolean, false) else s.searchable end
  where s.wedding_id = p_wedding_id;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.update_site(p_wedding_id uuid, p_changes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_site(p_wedding_id, p_changes);
$$;

comment on function public.update_site is
  'Owner and editors: change the site. p_changes holds only the keys to change (design, palette, welcome, story, family_title, family_lines, guide_title, livestream_url, livestream_note, rsvp_by, sections, searchable); null or "" clears one. Errors: not_allowed, invalid_changes, invalid_field, site_not_found, and check violations for values out of range.';

-- Change the site's link. Spaces and symbols become dashes.
create function private.set_site_slug(p_wedding_id uuid, p_slug text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := btrim(regexp_replace(lower(btrim(coalesce(p_slug, ''))), '[^a-z0-9]+', '-', 'g'), '-');
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(clean) not between 3 and 40 then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if exists (select 1 from public.wedding_sites s where s.slug = clean and s.wedding_id <> p_wedding_id) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;
  update public.wedding_sites s set slug = clean where s.wedding_id = p_wedding_id;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  return clean;
end;
$$;

create function public.set_site_slug(p_wedding_id uuid, p_slug text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.set_site_slug(p_wedding_id, p_slug);
$$;

comment on function public.set_site_slug is
  'Owner and editors: change the site''s link (3 to 40 letters, numbers and dashes; anything else becomes a dash). Returns the slug. Errors: not_allowed, invalid_slug, slug_taken, site_not_found.';

-- Set the site's password (4 to 64 characters; capitals don't matter, for
-- guests typing on a phone), or clear it with null or "".
create function private.set_site_password(p_wedding_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site uuid;
  pw text := lower(btrim(coalesce(p_password, '')));
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select s.id into target_site from public.wedding_sites s where s.wedding_id = p_wedding_id;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  if pw = '' then
    update public.wedding_site_locks l
    set password_hash = null, misses = 0, miss_day = null
    where l.site_id = target_site;
    return false;
  end if;
  if length(pw) not between 4 and 64 then
    raise exception 'invalid_password' using errcode = '22023';
  end if;
  insert into public.wedding_site_locks as l (site_id, password_hash)
  values (target_site, extensions.crypt(pw, extensions.gen_salt('bf')))
  on conflict on constraint wedding_site_locks_pkey do update
    set password_hash = excluded.password_hash, misses = 0, miss_day = null;
  return true;
end;
$$;

create function public.set_site_password(p_wedding_id uuid, p_password text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.set_site_password(p_wedding_id, p_password);
$$;

comment on function public.set_site_password is
  'Owner and editors: set the site''s password (4 to 64 characters, capitals don''t matter) or clear it with null. Returns whether it has one. Errors: not_allowed, invalid_password, site_not_found.';

-- Publish the site, or take it back to a draft.
create function private.publish_site(p_wedding_id uuid, p_publish boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  published timestamptz;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.wedding_sites s
  set published_at = case when coalesce(p_publish, false) then coalesce(s.published_at, now()) end
  where s.wedding_id = p_wedding_id
  returning s.published_at into published;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  return published;
end;
$$;

create function public.publish_site(p_wedding_id uuid, p_publish boolean)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.publish_site(p_wedding_id, p_publish);
$$;

comment on function public.publish_site is
  'Owner and editors: publish the site (guests can open it) or take it back to a draft. Returns when it was published, or null. Errors: not_allowed, site_not_found.';

-- Use an uploaded photo as the cover (all three sizes must be there), or
-- remove the cover with null. Returns the old cover's folder, for the app to
-- delete its files.
create function private.set_site_cover(p_wedding_id uuid, p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_path text;
  folder text := p_wedding_id::text || '/' || p_photo_id::text;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select s.cover_path into old_path from public.wedding_sites s
  where s.wedding_id = p_wedding_id
  for update;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  if p_photo_id is not null and (
    select count(*) from storage.objects o
    where o.bucket_id = 'site-media'
      and o.name in (folder || '/400.webp', folder || '/1080.webp', folder || '/1600.webp')
  ) < 3 then
    raise exception 'files_missing' using errcode = 'P0002';
  end if;
  update public.wedding_sites s
  set cover_path = case when p_photo_id is null then null else folder end
  where s.wedding_id = p_wedding_id;
  return nullif(old_path, case when p_photo_id is null then null else folder end);
end;
$$;

create function public.set_site_cover(p_wedding_id uuid, p_photo_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.set_site_cover(p_wedding_id, p_photo_id);
$$;

comment on function public.set_site_cover is
  'Owner and editors: use the photo uploaded to site-media/<wedding id>/<photo id>/ (400, 1080 and 1600 .webp) as the cover, or remove it with null. Returns the old cover''s folder to delete. Errors: not_allowed, site_not_found, files_missing.';

-- Replace one of the site's lists (tips, hotels or questions) with the items
-- given, in order: [{"title", "body", "link"}]. Items without a title are
-- dropped. Returns how many were saved.
create function private.set_site_items(p_wedding_id uuid, p_kind text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site uuid;
  saved integer;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('tip', 'hotel', 'faq') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > (case p_kind when 'tip' then 12 when 'hotel' then 6 else 20 end) then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;
  select s.id into target_site from public.wedding_sites s where s.wedding_id = p_wedding_id for update;
  if not found then
    raise exception 'site_not_found' using errcode = 'P0002';
  end if;
  delete from public.wedding_site_items it
  where it.site_id = target_site and it.kind = p_kind;
  insert into public.wedding_site_items (site_id, kind, position, title, body, link)
  select target_site, p_kind, row_number() over (order by t.n),
    btrim(t.item ->> 'title'),
    nullif(btrim(t.item ->> 'body'), ''),
    nullif(btrim(t.item ->> 'link'), '')
  from jsonb_array_elements(p_items) with ordinality as t(item, n)
  where jsonb_typeof(t.item) = 'object' and coalesce(btrim(t.item ->> 'title'), '') <> '';
  get diagnostics saved = row_count;
  return saved;
end;
$$;

create function public.set_site_items(p_wedding_id uuid, p_kind text, p_items jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.set_site_items(p_wedding_id, p_kind, p_items);
$$;

comment on function public.set_site_items is
  'Owner and editors: replace the site''s tips (up to 12), hotels (6) or faq (20) with [{"title", "body", "link"}] in order; items without a title are dropped, links must start with https://. Returns how many were saved. Errors: not_allowed, invalid_kind, invalid_items, too_many_items, site_not_found.';

-- One event's details for guests. Only the keys given change; null or "" clears.
create function private.set_event_site_details(p_wedding_id uuid, p_event_slug text, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_details) loop
    if k <> all (array['dress_code', 'dress_colors', 'guest_note', 'shown_publicly']) then
      raise exception 'invalid_field' using errcode = '22023', detail = k;
    end if;
  end loop;
  update public.wedding_events e set
    dress_code = case when p_details ? 'dress_code'
      then nullif(btrim(p_details ->> 'dress_code'), '') else e.dress_code end,
    dress_colors = case when p_details ? 'dress_colors'
      then array(select upper(c) from unnest(private.clean_lines(p_details -> 'dress_colors')) as c)
      else e.dress_colors end,
    guest_note = case when p_details ? 'guest_note'
      then nullif(btrim(p_details ->> 'guest_note'), '') else e.guest_note end,
    shown_publicly = case when p_details ? 'shown_publicly'
      then coalesce((p_details ->> 'shown_publicly')::boolean, true) else e.shown_publicly end
  where e.wedding_id = p_wedding_id and e.event_slug = p_event_slug;
  if not found then
    raise exception 'event_not_in_plan' using errcode = 'P0002';
  end if;
end;
$$;

create function public.set_event_site_details(p_wedding_id uuid, p_event_slug text, p_details jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_event_site_details(p_wedding_id, p_event_slug, p_details);
$$;

comment on function public.set_event_site_details is
  'Owner and editors: an event''s details for the wedding site. p_details holds only the keys to change (dress_code, dress_colors as up to three #RRGGBB, guest_note, shown_publicly); null or "" clears. Errors: not_allowed, invalid_changes, invalid_field, event_not_in_plan, and check violations.';

revoke all on function
  private.are_short_lines, private.are_hex_colors, private.is_site_sections, private.clean_lines,
  private.create_site, private.site_page, private.update_site, private.set_site_slug,
  private.set_site_password, private.publish_site, private.set_site_cover, private.set_site_items,
  private.set_event_site_details
  from public;
grant execute on function
  private.create_site, private.update_site, private.set_site_slug, private.set_site_password,
  private.publish_site, private.set_site_cover, private.set_site_items, private.set_event_site_details
  to authenticated;
grant execute on function private.site_page to anon, authenticated;
-- Pure checks that table constraints call, so any writer may run them
grant execute on function
  private.are_short_lines, private.are_hex_colors, private.is_site_sections, private.clean_lines
  to anon, authenticated;

revoke all on function
  public.create_site, public.site_page, public.update_site, public.set_site_slug,
  public.set_site_password, public.publish_site, public.set_site_cover, public.set_site_items,
  public.set_event_site_details
  from public;
grant execute on function
  public.create_site, public.update_site, public.set_site_slug, public.set_site_password,
  public.publish_site, public.set_site_cover, public.set_site_items, public.set_event_site_details
  to authenticated;
grant execute on function public.site_page to anon, authenticated;
