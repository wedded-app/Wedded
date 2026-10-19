-- The wedding plan, to the database design (The wedding plan): two sides, an
-- id for every event the wedding is having, and "this event needs a dhol"
-- kept apart from "we booked this dhol".
--
-- profiles.planning_for  Who someone is planning for moves from the wedding
--                        to the person.
-- wedding_cultures       The traditions a wedding follows, a row each
--                        (was weddings.traditions).
-- wedding_sides          Side A and side B ("Bride's side", "Groom's side",
--                        renamed however the couple likes). An event hosted
--                        by one side points at it; the shared lane is null.
-- wedding_members        Gain a side, a relation ("Mum") and the invite they
--                        joined with (was invited_by).
-- wedding_invites        Keep a hash of the link's token, never the token.
-- wedding_events         An id of its own, a host side, times, place, guest
--                        count, at home and a budget.
-- wedding_slots          One vendor type an event needs (2 dholis).
-- bookings               A vendor booked into a slot: confirmed by the family
--                        (and later the vendor), the agreed price private to
--                        the family. Replaces wedding_bookings.
-- suggestions            Was wedding_suggestions; points at the wedding's event.
-- shortlist_reactions    Was wedding_reactions.
-- saved_vendors          Saved to one of the wedding's events or to Not sure
--                        yet (was an event name with no wedding).
--
-- Writes that touch more than one row go through functions: set_booked(),
-- set_wedding_cultures() and save_vendor().

-- Who someone is planning for -----------------------------------------------------------

alter table public.profiles
  add column planning_for text
    check (planning_for in ('self', 'child', 'sibling', 'relative', 'friend'));

comment on column public.profiles.planning_for is
  'Who are you planning for? From the first questions: self, child, sibling, relative or friend.';

update public.profiles p
set planning_for = w.planning_for
from (
  select distinct on (created_by) created_by, planning_for
  from public.weddings
  where planning_for is not null and created_by is not null
  order by created_by, created_at
) w
where w.created_by = p.id;

-- Traditions ----------------------------------------------------------------------------

create table public.wedding_cultures (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  culture_slug text not null references public.cultures (slug) on update cascade,
  created_at timestamptz not null default now(),
  primary key (wedding_id, culture_slug)
);

comment on table public.wedding_cultures is
  'The traditions a wedding follows; several for a mixed family. None means the default tradition.';

create index wedding_cultures_culture_slug_idx on public.wedding_cultures (culture_slug);

insert into public.wedding_cultures (wedding_id, culture_slug)
select distinct w.id, t.slug
from public.weddings w
cross join lateral unnest(w.traditions) as t (slug)
where exists (select 1 from public.cultures c where c.slug = t.slug);

alter table public.wedding_cultures enable row level security;
create policy "Members read the traditions" on public.wedding_cultures
  for select to authenticated using (private.wedding_role(wedding_id) is not null);
revoke all on public.wedding_cultures from anon, authenticated;
grant select on public.wedding_cultures to authenticated;

alter table public.weddings drop column traditions, drop column planning_for;

-- Sides ---------------------------------------------------------------------------------

create table public.wedding_sides (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  side_key text not null check (side_key in ('a', 'b')),
  label text not null check (length(btrim(label)) between 1 and 40),
  home_city_slug text references public.cities (slug) on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_sides_one_per_key unique (wedding_id, side_key),
  -- What the side columns on members, invites and events point at, so a side
  -- always belongs to the same wedding
  constraint wedding_sides_in_wedding unique (wedding_id, id)
);

comment on table public.wedding_sides is
  'Side A and side B of a wedding, named however the couple likes (Bride''s side, Groom''s side, or two family names). home_city_slug is where that side searches from.';

create index wedding_sides_home_city_slug_idx on public.wedding_sides (home_city_slug);

insert into public.wedding_sides (wedding_id, side_key, label)
select w.id, s.side_key, s.label
from public.weddings w
cross join (values ('a', 'Bride''s side'), ('b', 'Groom''s side')) as s (side_key, label);

create trigger set_updated_at before update on public.wedding_sides
  for each row execute function private.set_updated_at();

alter table public.wedding_sides enable row level security;
create policy "Members read the sides" on public.wedding_sides
  for select to authenticated using (private.wedding_role(wedding_id) is not null);
revoke all on public.wedding_sides from anon, authenticated;
grant select on public.wedding_sides to authenticated;

-- Invites keep a hash of the token --------------------------------------------------------

alter table public.wedding_invites add column token_hash text;
update public.wedding_invites set token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
alter table public.wedding_invites
  alter column token_hash set not null,
  add constraint wedding_invites_token_hash_key unique (token_hash),
  drop column token;
alter table public.wedding_invites
  add column side_id uuid,
  add constraint wedding_invites_side_fkey foreign key (wedding_id, side_id)
    references public.wedding_sides (wedding_id, id) on delete set null (side_id);

comment on column public.wedding_invites.token_hash is
  'SHA-256 of the link''s token (hex). The token itself is only ever in the link.';

create index wedding_invites_side_idx on public.wedding_invites (wedding_id, side_id);

-- Members -------------------------------------------------------------------------------

alter table public.wedding_members
  drop column invited_by,
  add column side_id uuid,
  add column relation text check (length(btrim(relation)) between 1 and 40),
  add column invite_id uuid references public.wedding_invites (id) on delete set null;
alter table public.wedding_members
  add constraint wedding_members_side_fkey foreign key (wedding_id, side_id)
    references public.wedding_sides (wedding_id, id) on delete set null (side_id);

comment on column public.wedding_members.side_id is
  'Which side they''re on; the other side sees dates and booked-or-not only. Null: both.';
comment on column public.wedding_members.relation is 'What they are to the couple: Mum, Bhua ji.';

create index wedding_members_side_idx on public.wedding_members (wedding_id, side_id);
create index wedding_members_invite_id_idx on public.wedding_members (invite_id);

-- Events get an id ----------------------------------------------------------------------

alter table public.wedding_bookings drop constraint wedding_bookings_wedding_id_event_slug_fkey;
alter table public.wedding_suggestions drop constraint wedding_suggestions_wedding_id_event_slug_fkey;

alter table public.wedding_events drop constraint wedding_events_pkey;
alter table public.wedding_events add column id uuid not null default gen_random_uuid();
alter table public.wedding_events
  add constraint wedding_events_pkey primary key (id),
  add constraint wedding_events_one_per_event unique (wedding_id, event_slug),
  add constraint wedding_events_in_wedding unique (wedding_id, id);

alter table public.wedding_events
  add column side_id uuid,
  add column starts_at time,
  add column ends_at time,
  add column venue_id uuid references public.vendors (id) on delete set null,
  add column venue_text text check (length(btrim(venue_text)) between 1 and 200),
  add column city_slug text references public.cities (slug) on update cascade,
  add column guest_count integer check (guest_count between 1 and 5000),
  add column at_home boolean not null default false,
  add column budget_cents integer check (budget_cents >= 0);
alter table public.wedding_events
  add constraint wedding_events_side_fkey foreign key (wedding_id, side_id)
    references public.wedding_sides (wedding_id, id) on delete set null (side_id);

comment on column public.wedding_events.side_id is
  'The side hosting it; null is the shared lane (the gurdwara day).';
comment on column public.wedding_events.venue_id is 'A listed hall or gurdwara; venue_text otherwise.';
comment on column public.wedding_events.at_home is 'At home: adds the home event kit.';

create index wedding_events_side_idx on public.wedding_events (wedding_id, side_id);
create index wedding_events_venue_id_idx on public.wedding_events (venue_id);
create index wedding_events_city_slug_idx on public.wedding_events (city_slug);

-- A new event's host side comes from the event (a jaago is the bride's side's)
create function private.default_event_side()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.side_id is null then
    select s.id into new.side_id
    from public.events e
    join public.wedding_sides s
      on s.wedding_id = new.wedding_id
      and s.side_key = case e.host_side when 'bride' then 'a' when 'groom' then 'b' end
    where e.slug = new.event_slug;
  end if;
  return new;
end;
$$;

create trigger default_event_side before insert on public.wedding_events
  for each row execute function private.default_event_side();

update public.wedding_events we
set side_id = s.id
from public.events e, public.wedding_sides s
where e.slug = we.event_slug
  and s.wedding_id = we.wedding_id
  and s.side_key = case e.host_side when 'bride' then 'a' when 'groom' then 'b' end;

-- Slots and bookings --------------------------------------------------------------------

create table public.wedding_slots (
  id uuid primary key default gen_random_uuid(),
  wedding_event_id uuid not null references public.wedding_events (id) on delete cascade,
  category_slug text not null references public.categories (slug) on update cascade,
  quantity smallint not null default 1 check (quantity between 1 and 50),
  book_by date,
  note text check (length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_slots_one_per_type unique (wedding_event_id, category_slug)
);

comment on table public.wedding_slots is
  'One vendor type an event needs (2 dholis). Booked when it has a live booking, Choose when the family saved candidates, Find otherwise.';

create index wedding_slots_category_slug_idx on public.wedding_slots (category_slug);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.wedding_slots (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete set null,
  vendor_name text check (length(btrim(vendor_name)) between 1 and 120),
  inquiry_id uuid references public.inquiries (id) on delete set null,
  status text not null default 'confirmed'
    check (status in ('held', 'confirmed', 'canceled', 'completed')),
  booked_by uuid references auth.users (id) on delete set null,
  family_confirmed_at timestamptz,
  vendor_confirmed_at timestamptz,
  agreed_cents integer check (agreed_cents >= 0),
  canceled_reason text check (length(btrim(canceled_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bookings is
  'The record that a family booked a vendor for a slot. A record both sides confirm, never escrow or a contract. vendor_id is null for a vendor not on Wedded (vendor_name then) or a slot ticked off without naming one; agreed_cents is private to the family.';

-- shortcut: one live booking per slot, which is all the plan shows today; drop it when a slot can take several vendors (2 dholis from 2 groups)
create unique index bookings_one_live_per_slot on public.bookings (slot_id) where status <> 'canceled';
create index bookings_vendor_id_idx on public.bookings (vendor_id);
create index bookings_inquiry_id_idx on public.bookings (inquiry_id);
create index bookings_booked_by_idx on public.bookings (booked_by);

insert into public.wedding_slots (wedding_event_id, category_slug, note, created_at, updated_at)
select we.id, b.category_slug, nullif(left(btrim(b.note), 500), ''), b.created_at, b.updated_at
from public.wedding_bookings b
join public.wedding_events we on we.wedding_id = b.wedding_id and we.event_slug = b.event_slug;

insert into public.bookings (slot_id, vendor_id, booked_by, family_confirmed_at, created_at, updated_at)
select s.id, b.vendor_id, b.updated_by, b.created_at, b.created_at, b.updated_at
from public.wedding_bookings b
join public.wedding_events we on we.wedding_id = b.wedding_id and we.event_slug = b.event_slug
join public.wedding_slots s on s.wedding_event_id = we.id and s.category_slug = b.category_slug;

drop table public.wedding_bookings;
drop function private.stamp_booking_editor();

create trigger set_updated_at before update on public.wedding_slots
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

alter table public.wedding_slots enable row level security;
alter table public.bookings enable row level security;
create policy "Members read the slots" on public.wedding_slots
  for select to authenticated
  using (exists (
    select 1 from public.wedding_events we
    where we.id = wedding_event_id and private.wedding_role(we.wedding_id) is not null
  ));
create policy "Members read the bookings" on public.bookings
  for select to authenticated
  using (exists (
    select 1
    from public.wedding_slots s
    join public.wedding_events we on we.id = s.wedding_event_id
    where s.id = slot_id and private.wedding_role(we.wedding_id) is not null
  ));
revoke all on public.wedding_slots, public.bookings from anon, authenticated;
grant select on public.wedding_slots, public.bookings to authenticated;

-- At most 40 events and 400 slots a wedding
create or replace function private.check_wedding_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  wedding uuid;
begin
  if tg_table_name = 'wedding_events' then
    if (select count(*) from public.wedding_events where wedding_id = new.wedding_id) >= 40 then
      raise exception 'wedding_too_many_events' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'wedding_slots' then
    select we.wedding_id into wedding from public.wedding_events we where we.id = new.wedding_event_id;
    if (select count(*)
        from public.wedding_slots s
        join public.wedding_events we on we.id = s.wedding_event_id
        where we.wedding_id = wedding) >= 400 then
      raise exception 'wedding_too_many_slots' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger check_wedding_limits before insert on public.wedding_slots
  for each row execute function private.check_wedding_limits();

-- Books a vendor (or, with no vendor, just ticks the slot off) for one of a
-- wedding's events and a vendor type, making the slot if needed. A slot keeps
-- its live booking; a vendor fills one that has none, and replaces one only
-- when p_replace_vendor (accepting a suggestion).
create function private.book_slot(
  p_wedding_event_id uuid, p_category_slug text, p_vendor_id uuid, p_inquiry_id uuid,
  p_by uuid, p_replace_vendor boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot uuid;
  live public.bookings;
begin
  insert into public.wedding_slots (wedding_event_id, category_slug)
  values (p_wedding_event_id, p_category_slug)
  on conflict (wedding_event_id, category_slug) do nothing;
  select s.id into slot from public.wedding_slots s
  where s.wedding_event_id = p_wedding_event_id and s.category_slug = p_category_slug;

  select * into live from public.bookings b
  where b.slot_id = slot and b.status <> 'canceled'
  for update;
  if live.id is null then
    insert into public.bookings (slot_id, vendor_id, inquiry_id, booked_by, family_confirmed_at)
    values (slot, p_vendor_id, p_inquiry_id, p_by, now())
    returning id into live.id;
  elsif p_vendor_id is not null and (p_replace_vendor or live.vendor_id is null) then
    update public.bookings
    set vendor_id = p_vendor_id, inquiry_id = coalesce(p_inquiry_id, inquiry_id)
    where id = live.id;
  end if;
  return live.id;
end;
$$;

revoke all on function private.book_slot from public, anon, authenticated;

-- The plan's checklist: tick a vendor type booked for an event, or untick it
create function private.set_booked(
  p_wedding_id uuid, p_event_slug text, p_category_slug text, p_booked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select we.id into event_id from public.wedding_events we
  where we.wedding_id = p_wedding_id and we.event_slug = p_event_slug;
  if event_id is null then
    raise exception 'event_not_in_plan' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.categories where slug = p_category_slug) then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;

  if p_booked then
    perform private.book_slot(event_id, p_category_slug, null, null, (select auth.uid()), false);
  else
    delete from public.bookings b
    using public.wedding_slots s
    where b.slot_id = s.id
      and s.wedding_event_id = event_id
      and s.category_slug = p_category_slug
      and b.status <> 'canceled';
  end if;
end;
$$;

create function public.set_booked(
  p_wedding_id uuid, p_event_slug text, p_category_slug text, p_booked boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_booked(p_wedding_id, p_event_slug, p_category_slug, p_booked);
$$;

comment on function public.set_booked is
  'Owners and editors: tick a vendor type booked for one of the plan''s events, or untick it (removes the booking). Errors: not_allowed, event_not_in_plan, category_not_found.';

-- The plan's traditions, replaced as a set
create function private.set_wedding_cultures(p_wedding_id uuid, p_culture_slugs text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_culture_slugs, '{}')) > 10 then
    raise exception 'too_many_traditions' using errcode = '22023';
  end if;
  delete from public.wedding_cultures
  where wedding_id = p_wedding_id and culture_slug <> all (coalesce(p_culture_slugs, '{}'));
  insert into public.wedding_cultures (wedding_id, culture_slug)
  select p_wedding_id, c.slug from public.cultures c where c.slug = any (coalesce(p_culture_slugs, '{}'))
  on conflict do nothing;
end;
$$;

create function public.set_wedding_cultures(p_wedding_id uuid, p_culture_slugs text[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_wedding_cultures(p_wedding_id, p_culture_slugs);
$$;

comment on function public.set_wedding_cultures is
  'Owners and editors: the traditions the wedding follows (empty: the default one). Unknown slugs are skipped. Errors: not_allowed, too_many_traditions.';

-- Suggestions and the shortlist ---------------------------------------------------------

alter table public.wedding_suggestions rename to suggestions;
alter table public.suggestions add column wedding_event_id uuid;
update public.suggestions s
set wedding_event_id = we.id
from public.wedding_events we
where we.wedding_id = s.wedding_id and we.event_slug = s.event_slug;
delete from public.suggestions where wedding_event_id is null;
drop index public.wedding_suggestions_one_open;
drop index public.wedding_suggestions_event_idx;
alter table public.suggestions
  alter column wedding_event_id set not null,
  drop column event_slug,
  add constraint suggestions_wedding_event_fkey foreign key (wedding_id, wedding_event_id)
    references public.wedding_events (wedding_id, id) on delete cascade;
create unique index suggestions_one_open on public.suggestions (wedding_event_id, category_slug, vendor_id)
  where status = 'open';
create index suggestions_wedding_event_idx on public.suggestions (wedding_id, wedding_event_id);

alter table public.wedding_reactions rename to shortlist_reactions;

-- The old names on keys, checks and indexes follow the tables
do $$
declare
  r record;
begin
  for r in
    select c.conname as name, c.conrelid::regclass::text as tbl, 'constraint' as kind
    from pg_constraint c
    where c.conrelid in ('public.suggestions'::regclass, 'public.shortlist_reactions'::regclass)
      and (c.conname like 'wedding_suggestions%' or c.conname like 'wedding_reactions%')
  loop
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.name,
      replace(replace(r.name, 'wedding_suggestions', 'suggestions'), 'wedding_reactions', 'shortlist_reactions'));
  end loop;
  for r in
    select i.relname as name
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public' and i.relkind = 'i'
      and (i.relname like 'wedding_suggestions%' or i.relname like 'wedding_reactions%')
  loop
    execute format('alter index public.%I rename to %I', r.name,
      replace(replace(r.name, 'wedding_suggestions', 'suggestions'), 'wedding_reactions', 'shortlist_reactions'));
  end loop;
end;
$$;

-- Saves belong to the wedding's events --------------------------------------------------

alter table public.saved_vendors
  add column wedding_id uuid references public.weddings (id) on delete set null,
  add column wedding_event_id uuid references public.wedding_events (id) on delete set null,
  add column note text check (length(btrim(note)) between 1 and 300),
  add column source text not null default 'heart'
    check (source in ('heart', 'inquiry', 'suggestion', 'seen_live', 'qr', 'share_link', 'wed'));

comment on column public.saved_vendors.wedding_event_id is
  'The wedding''s event it''s saved to; null is Not sure yet.';
comment on column public.saved_vendors.note is 'A note for the family: Bibi ji said too expensive.';

-- Someone's main wedding: their own first, then one they edit, then the
-- earliest they joined (what the app opens)
create function private.primary_wedding(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.wedding_id
  from public.wedding_members m
  where m.user_id = p_user_id
  order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, m.joined_at
  limit 1;
$$;

revoke all on function private.primary_wedding from public, anon, authenticated;

update public.saved_vendors s
set wedding_id = private.primary_wedding(s.user_id);
update public.saved_vendors s
set wedding_event_id = we.id
from public.wedding_events we
where we.wedding_id = s.wedding_id and we.event_slug = s.event_slug;

-- An event the plan doesn't have becomes Not sure yet, keeping one save each
delete from public.saved_vendors s
using public.saved_vendors keep
where keep.user_id = s.user_id
  and keep.vendor_id = s.vendor_id
  and keep.wedding_event_id is not distinct from s.wedding_event_id
  and (keep.created_at, keep.id) < (s.created_at, s.id);

alter table public.saved_vendors
  drop constraint saved_vendors_once_per_event,
  drop column event_slug,
  add constraint saved_vendors_once_per_event unique nulls not distinct (user_id, vendor_id, wedding_event_id);

create index saved_vendors_wedding_id_idx on public.saved_vendors (wedding_id);
create index saved_vendors_wedding_event_id_idx on public.saved_vendors (wedding_event_id);

drop policy "People can save published vendors for themselves" on public.saved_vendors;
revoke insert on public.saved_vendors from authenticated;

-- Removing an event moves its saves to Not sure yet; one already there wins
create function private.before_wedding_event_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_vendors s
  where s.wedding_event_id = old.id
    and exists (
      select 1 from public.saved_vendors n
      where n.user_id = s.user_id and n.vendor_id = s.vendor_id and n.wedding_event_id is null
    );
  return old;
end;
$$;

create trigger before_wedding_event_removed before delete on public.wedding_events
  for each row execute function private.before_wedding_event_removed();

-- Save a vendor for someone, to their main wedding's event (added to the plan
-- when they can edit it and it isn't there yet), or to Not sure yet. Returns
-- the event it was saved to, or null.
create function private.save_for(p_user_id uuid, p_vendor_id uuid, p_event_slug text, p_source text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wedding uuid := private.primary_wedding(p_user_id);
  event_id uuid;
begin
  if p_event_slug is not null and wedding is not null then
    select we.id into event_id from public.wedding_events we
    where we.wedding_id = wedding and we.event_slug = p_event_slug;
    if event_id is null
      and exists (select 1 from public.events e where e.slug = p_event_slug)
      and exists (select 1 from public.wedding_members m
                  where m.wedding_id = wedding and m.user_id = p_user_id and m.role in ('owner', 'editor'))
    then
      insert into public.wedding_events (wedding_id, event_slug) values (wedding, p_event_slug)
      on conflict (wedding_id, event_slug) do nothing;
      select we.id into event_id from public.wedding_events we
      where we.wedding_id = wedding and we.event_slug = p_event_slug;
    end if;
  end if;

  insert into public.saved_vendors (user_id, vendor_id, wedding_id, wedding_event_id, source)
  values (p_user_id, p_vendor_id, wedding, event_id, p_source)
  on conflict on constraint saved_vendors_once_per_event do nothing;
  return case when event_id is not null then p_event_slug end;
end;
$$;

revoke all on function private.save_for from public, anon, authenticated;
grant execute on function private.save_for to service_role;

create function private.save_vendor(p_vendor_id uuid, p_event_slug text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vendors where id = p_vendor_id and status = 'published') then
    raise exception 'vendor_not_found' using errcode = 'P0002';
  end if;
  return private.save_for(caller, p_vendor_id, p_event_slug, 'heart');
end;
$$;

create function public.save_vendor(p_vendor_id uuid, p_event_slug text default null)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.save_vendor(p_vendor_id, p_event_slug);
$$;

comment on function public.save_vendor is
  'Save a published vendor to one of your wedding''s events (added to the plan if you can edit it), or to Not sure yet with no event. Returns the event it was saved to, or null. Saving twice is harmless. Errors: not_signed_in, vendor_not_found.';

-- Creating a wedding --------------------------------------------------------------------

drop function public.create_wedding(text, date, text, text[], jsonb);
drop function private.create_wedding(text, date, text, text[], jsonb);

create function private.create_wedding(
  p_title text, p_wedding_date date, p_planning_for text, p_cultures text[], p_events text[],
  p_guests jsonb, p_booked jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_id uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if (select count(*) from public.wedding_members where user_id = caller and role = 'owner') >= 5 then
    raise exception 'wedding_limit' using errcode = 'P0001';
  end if;

  insert into public.weddings (title, wedding_date, created_by)
  values (nullif(btrim(p_title), ''), p_wedding_date, caller)
  returning id into new_id;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (new_id, caller, 'owner');

  insert into public.wedding_sides (wedding_id, side_key, label)
  values (new_id, 'a', 'Bride''s side'), (new_id, 'b', 'Groom''s side');

  if p_planning_for in ('self', 'child', 'sibling', 'relative', 'friend') then
    update public.profiles set planning_for = p_planning_for where id = caller;
  end if;

  insert into public.wedding_cultures (wedding_id, culture_slug)
  select new_id, c.slug from public.cultures c
  where c.slug = any (coalesce(p_cultures, '{}'));

  insert into public.wedding_events (wedding_id, event_slug, guest_band)
  select new_id, e.slug,
    case when coalesce(p_guests, '{}'::jsonb) ->> e.slug
      in ('under_50', '50_100', '100_250', '250_500', '500_plus', 'not_sure')
      then p_guests ->> e.slug end
  from public.events e
  where e.slug = any (coalesce(p_events, '{}'));

  insert into public.wedding_slots (wedding_event_id, category_slug)
  select distinct we.id, c.slug
  from jsonb_each(coalesce(p_booked, '{}'::jsonb)) as b
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(b.value) = 'array' then b.value else '[]'::jsonb end
  ) as picked (category_slug)
  join public.wedding_events we on we.wedding_id = new_id and we.event_slug = b.key
  join public.categories c on c.slug = picked.category_slug;

  insert into public.bookings (slot_id, booked_by, family_confirmed_at)
  select s.id, caller, now()
  from public.wedding_slots s
  join public.wedding_events we on we.id = s.wedding_event_id
  where we.wedding_id = new_id;

  -- Hearts from before the plan existed join it, as Not sure yet
  update public.saved_vendors set wedding_id = new_id
  where user_id = caller and wedding_id is null;

  return new_id;
end;
$$;

create function public.create_wedding(
  p_title text default null, p_wedding_date date default null, p_planning_for text default null,
  p_cultures text[] default '{}', p_events text[] default '{}', p_guests jsonb default '{}',
  p_booked jsonb default '{}')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_wedding(p_title, p_wedding_date, p_planning_for, p_cultures, p_events, p_guests, p_booked);
$$;

comment on function public.create_wedding is
  'Start a wedding you own, with its two sides, traditions, events (guest band per event in p_guests: {"jaago": "100_250"}) and the vendor types already booked per event (p_booked: {"jaago": ["dhol"]}). planning_for goes on your profile. At most 5 you own. Errors: not_signed_in, wedding_limit.';

-- Invites -------------------------------------------------------------------------------

create or replace function private.create_wedding_invite(p_wedding_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('editor', 'suggester') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if (select count(*) from public.wedding_invites
      where wedding_id = p_wedding_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;

  insert into public.wedding_invites (wedding_id, role, created_by, token_hash)
  values (p_wedding_id, p_role, (select auth.uid()),
    encode(sha256(convert_to(new_token, 'UTF8')), 'hex'));
  return new_token;
end;
$$;

create or replace function private.accept_wedding_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  inv public.wedding_invites;
  current_role_in_wedding text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into inv from public.wedding_invites i
  where i.token_hash = encode(sha256(convert_to(lower(btrim(p_token)), 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  current_role_in_wedding := private.wedding_role(inv.wedding_id);
  if current_role_in_wedding is not null then
    if current_role_in_wedding = 'suggester' and inv.role = 'editor'
      and inv.revoked_at is null and inv.expires_at > now() then
      update public.wedding_members set role = 'editor'
      where wedding_id = inv.wedding_id and user_id = caller;
    end if;
    return inv.wedding_id;
  end if;

  if inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  elsif inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  elsif inv.uses >= inv.max_uses then
    raise exception 'invite_used_up' using errcode = 'P0001';
  end if;
  if (select count(*) from public.wedding_members where wedding_id = inv.wedding_id) >= 30 then
    raise exception 'wedding_full' using errcode = 'P0001';
  end if;
  if (select count(*) from public.wedding_members where user_id = caller) >= 10 then
    raise exception 'too_many_weddings' using errcode = 'P0001';
  end if;

  insert into public.wedding_members (wedding_id, user_id, role, side_id, invite_id)
  values (inv.wedding_id, caller, inv.role, inv.side_id, inv.id);
  update public.wedding_invites set uses = uses + 1 where id = inv.id;
  return inv.wedding_id;
end;
$$;

create or replace function private.wedding_invite_preview(p_token text)
returns table (status text, title text, wedding_date date, inviter_name text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv public.wedding_invites;
begin
  select * into inv from public.wedding_invites i
  where i.token_hash = encode(sha256(convert_to(lower(btrim(p_token)), 'UTF8')), 'hex');
  if not found then
    return query select 'not_found'::text, null::text, null::date, null::text, null::text;
    return;
  end if;
  return query
  select
    case
      when inv.revoked_at is not null then 'revoked'
      when inv.expires_at <= now() then 'expired'
      when inv.uses >= inv.max_uses then 'used_up'
      else 'valid'
    end,
    w.title,
    w.wedding_date,
    -- First name only
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    inv.role
  from public.weddings w
  left join public.profiles p on p.id = inv.created_by
  where w.id = inv.wedding_id;
end;
$$;

-- Suggestions ---------------------------------------------------------------------------

create or replace function private.suggest_vendor(
  p_wedding_id uuid, p_event_slug text, p_category_slug text, p_vendor_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  event_id uuid;
  existing uuid;
  new_id uuid;
begin
  if private.wedding_role(p_wedding_id) is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select we.id into event_id from public.wedding_events we
  where we.wedding_id = p_wedding_id and we.event_slug = p_event_slug;
  if event_id is null then
    raise exception 'event_not_in_plan' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.vendors where id = p_vendor_id and status = 'published') then
    raise exception 'vendor_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.categories where slug = p_category_slug) then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;

  select s.id into existing from public.suggestions s
  where s.wedding_event_id = event_id and s.category_slug = p_category_slug
    and s.vendor_id = p_vendor_id and s.status = 'open';
  if existing is not null then
    return existing;
  end if;

  if (select count(*) from public.suggestions
      where wedding_id = p_wedding_id and suggested_by = caller and status = 'open') >= 20 then
    raise exception 'suggestion_limit' using errcode = 'P0001';
  end if;

  insert into public.suggestions
    (wedding_id, wedding_event_id, category_slug, vendor_id, note, suggested_by)
  values (p_wedding_id, event_id, p_category_slug, p_vendor_id, nullif(btrim(p_note), ''), caller)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function private.resolve_suggestion(p_suggestion_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  s public.suggestions;
begin
  select * into s from public.suggestions where id = p_suggestion_id for update;
  if not found or private.wedding_role(s.wedding_id) is null then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;
  if not private.can_edit_wedding(s.wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if s.status <> 'open' then
    raise exception 'already_resolved' using errcode = 'P0001';
  end if;

  update public.suggestions
  set status = case when p_accept then 'accepted' else 'declined' end,
      resolved_by = caller,
      resolved_at = now()
  where id = s.id;

  if p_accept then
    perform private.book_slot(s.wedding_event_id, s.category_slug, s.vendor_id, null, caller, true);
  end if;
end;
$$;

create or replace function private.withdraw_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.suggestions
  where id = p_suggestion_id and suggested_by = (select auth.uid()) and status = 'open';
end;
$$;

-- The family shortlist: everything the wedding's members saved to it
create or replace function private.wedding_shortlist(p_wedding_id uuid)
returns table (
  vendor_id uuid, slug text, name text, city text, published boolean, event_slugs text[],
  saved_by text[], loves integer, maybes integer, nos integer, my_reaction text, loved_by text[])
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select m.user_id
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and private.wedding_role(p_wedding_id) is not null
  ),
  saves as (
    select
      s.vendor_id,
      array_agg(distinct we.event_slug) filter (where we.event_slug is not null) as event_slugs,
      array_agg(distinct coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), '?')) as saved_by
    from public.saved_vendors s
    join members on members.user_id = s.user_id
    left join public.wedding_events we on we.id = s.wedding_event_id
    left join public.profiles p on p.id = s.user_id
    where s.wedding_id = p_wedding_id
    group by s.vendor_id
  ),
  reactions as (
    select
      r.vendor_id,
      (count(*) filter (where r.reaction = 'love'))::integer as loves,
      (count(*) filter (where r.reaction = 'maybe'))::integer as maybes,
      (count(*) filter (where r.reaction = 'no'))::integer as nos,
      max(r.reaction) filter (where r.user_id = (select auth.uid())) as my_reaction,
      array_agg(coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), '?'))
        filter (where r.reaction = 'love') as loved_by
    from public.shortlist_reactions r
    left join public.profiles p on p.id = r.user_id
    where r.wedding_id = p_wedding_id
      and r.user_id in (select user_id from members)
    group by r.vendor_id
  )
  select
    v.id, v.slug, v.name, v.city, v.status = 'published',
    coalesce(saves.event_slugs, '{}'), saves.saved_by,
    coalesce(reactions.loves, 0), coalesce(reactions.maybes, 0), coalesce(reactions.nos, 0),
    reactions.my_reaction, coalesce(reactions.loved_by, '{}')
  from saves
  join public.vendors v on v.id = saves.vendor_id
  left join reactions on reactions.vendor_id = saves.vendor_id
  order by coalesce(reactions.loves, 0) desc, coalesce(reactions.nos, 0), v.name;
$$;

create or replace function public.react_to_vendor(p_wedding_id uuid, p_vendor_id uuid, p_reaction text)
returns void
language sql
set search_path = ''
as $$
  insert into public.shortlist_reactions (wedding_id, vendor_id, reaction)
  values (p_wedding_id, p_vendor_id, p_reaction)
  on conflict (wedding_id, vendor_id, user_id) do update set reaction = excluded.reaction;
$$;

-- "Yes, we booked them" books the vendor into the family's plan -------------------------

create or replace function private.book_from_followup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  main_category text;
  event_id uuid;
begin
  if new.reply_answer is distinct from 'booked'
    or old.reply_answer is not distinct from 'booked'
    or new.user_id is null then
    return new;
  end if;

  select vc.category_slug into main_category
  from public.vendor_categories vc
  where vc.vendor_id = new.vendor_id
  order by vc.position
  limit 1;
  if main_category is null then
    return new;
  end if;

  for event_id in
    select we.id
    from public.wedding_members m
    join public.wedding_events we on we.wedding_id = m.wedding_id
    where m.user_id = new.user_id
      and m.role in ('owner', 'editor')
      and we.event_slug = any (new.event_slugs)
  loop
    perform private.book_slot(event_id, main_category, new.vendor_id, new.id, new.user_id, false);
  end loop;

  return new;
end;
$$;

-- Vendor numbers count bookings ----------------------------------------------------------

create or replace function private.vendor_public_stats(p_vendor_id uuid)
returns table (saved_by integer, replied integer, answered integer, booked_by integer)
language sql
stable
security definer
set search_path = ''
as $$
  with vendor as (
    select v.id from public.vendors v where v.id = p_vendor_id and v.status = 'published'
  ),
  saves as (
    select count(distinct s.user_id)::integer as n
    from public.saved_vendors s
    join vendor on vendor.id = s.vendor_id
  ),
  answers as (
    select
      (count(*) filter (where i.reply_answer in ('booked', 'deciding')))::integer as replied,
      (count(*) filter (where i.reply_answer is not null))::integer as answered
    from public.inquiries i
    join vendor on vendor.id = i.vendor_id
  ),
  booked as (
    select count(distinct we.wedding_id)::integer as n
    from public.bookings b
    join vendor on vendor.id = b.vendor_id
    join public.wedding_slots s on s.id = b.slot_id
    join public.wedding_events we on we.id = s.wedding_event_id
    where b.status <> 'canceled'
  )
  select
    case when saves.n >= 5 then saves.n end,
    case when answers.answered >= 5 then answers.replied end,
    case when answers.answered >= 5 then answers.answered end,
    case when booked.n >= 5 then booked.n end
  from saves, answers, booked
  where exists (select 1 from vendor);
$$;

revoke all on function
  private.set_booked, public.set_booked,
  private.set_wedding_cultures, public.set_wedding_cultures,
  private.save_vendor, public.save_vendor,
  private.create_wedding, public.create_wedding
  from public, anon;
grant execute on function
  private.set_booked, public.set_booked,
  private.set_wedding_cultures, public.set_wedding_cultures,
  private.save_vendor, public.save_vendor,
  private.create_wedding, public.create_wedding
  to authenticated;

-- Booked families in a vendor's insights come from bookings
CREATE OR REPLACE FUNCTION private.business_insights(p_vendor_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  starts timestamptz := p_from::timestamp at time zone 'America/Los_Angeles';
  ends timestamptz := (p_to + 1)::timestamp at time zone 'America/Los_Angeles';
  contact_kinds text[] := array['call', 'text', 'whatsapp', 'directions', 'instagram', 'website'];
  result jsonb;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  with
  activity as (
    select a.day, a.kind, a.count
    from public.vendor_activity_daily a
    where a.vendor_id = p_vendor_id and a.day between p_from and p_to
  ),
  leads as (
    select i.*,
      -- The vendor's first message in the family's chat after the inquiry
      (select min(m.created_at)
       from public.conversations c
       join public.messages m on m.conversation_id = c.id
       where c.vendor_id = i.vendor_id
         and c.family_user_id = i.user_id
         and m.sender_role = 'vendor'
         and m.created_at > i.created_at) as first_reply_at
    from public.inquiries i
    where i.vendor_id = p_vendor_id and i.created_at >= starts and i.created_at < ends
  ),
  saves as (
    select s.created_at from public.saved_vendors s
    where s.vendor_id = p_vendor_id and s.created_at >= starts and s.created_at < ends
  ),
  -- Families who booked them: a shared plan naming them, or "Yes, we booked
  -- them" from a family without one
  booked as (
    select 'w:' || we.wedding_id::text as family
    from public.bookings b
    join public.wedding_slots s on s.id = b.slot_id
    join public.wedding_events we on we.id = s.wedding_event_id
    where b.vendor_id = p_vendor_id and b.status <> 'canceled'
      and b.updated_at >= starts and b.updated_at < ends
    union
    select 'u:' || i.user_id::text
    from public.inquiries i
    where i.vendor_id = p_vendor_id
      and i.reply_answer = 'booked'
      and i.reply_answered_at >= starts and i.reply_answered_at < ends
      and i.user_id is not null
      and not exists (
        select 1 from public.bookings b
        join public.wedding_slots s on s.id = b.slot_id
        join public.wedding_events we on we.id = s.wedding_event_id
        join public.wedding_members wm on wm.wedding_id = we.wedding_id
        where b.vendor_id = p_vendor_id and b.status <> 'canceled' and wm.user_id = i.user_id
      )
  )
  select jsonb_build_object(
    'daily', (
      select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'views', coalesce((select sum(a.count) from activity a where a.day = d.day and a.kind = 'view'), 0),
          'contacts', coalesce((select sum(a.count) from activity a
                                where a.day = d.day and a.kind = any (contact_kinds)), 0),
          'saves', (select count(*) from saves s
                    where (s.created_at at time zone 'America/Los_Angeles')::date = d.day),
          'inquiries', (select count(*) from leads l
                        where (l.created_at at time zone 'America/Los_Angeles')::date = d.day)
        ) order by d.day)
      from (select generate_series(p_from, p_to, interval '1 day')::date as day) as d
    ),
    'funnel', jsonb_build_object(
      'searches', coalesce((select sum(a.count) from activity a where a.kind = 'search'), 0),
      'views', coalesce((select sum(a.count) from activity a where a.kind = 'view'), 0),
      'saves', (select count(*) from saves),
      'contacts', coalesce((select sum(a.count) from activity a where a.kind = any (contact_kinds)), 0),
      'inquiries', (select count(*) from leads),
      'booked', (select count(*) from booked)
    ),
    'replies', (
      select jsonb_build_object(
        'leads', count(*),
        'replied', count(first_reply_at),
        'rate', case when count(*) > 0 then round(count(first_reply_at)::numeric / count(*), 2) end,
        'medianMinutes', round((percentile_cont(0.5) within group (
          order by extract(epoch from first_reply_at - created_at) / 60
        ))::numeric)
      )
      from leads
    ),
    'asks', jsonb_build_object(
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('slug', t.slug, 'name', e.name, 'count', t.n)
          order by t.n desc, t.slug)
        from (
          select slug, count(*) as n from leads, unnest(leads.event_slugs) as slug
          group by slug order by n desc, slug limit 5
        ) as t
        join public.events e on e.slug = t.slug
      ), '[]'::jsonb),
      'guests', coalesce((
        select jsonb_agg(jsonb_build_object('band', t.guest_band, 'count', t.n) order by t.n desc, t.guest_band)
        from (
          select guest_band, count(*) as n from leads
          group by guest_band order by n desc, guest_band limit 5
        ) as t
      ), '[]'::jsonb),
      'months', coalesce((
        select jsonb_agg(jsonb_build_object('month', t.month, 'count', t.n) order by t.n desc, t.month)
        from (
          select to_char(event_date, 'YYYY-MM') as month, count(*) as n from leads
          where event_date is not null
          group by 1 order by n desc, month limit 5
        ) as t
      ), '[]'::jsonb),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('place', t.place, 'count', t.n) order by t.n desc, t.place)
        from (
          select initcap(lower(btrim(location))) as place, count(*) as n from leads
          group by 1 order by n desc, place limit 5
        ) as t
      ), '[]'::jsonb)
    )
  )
  into result;

  return result || jsonb_build_object('compare', private.business_compare(p_vendor_id, p_from, p_to));
end;
$function$;

-- Asking a vendor saves them under those events of the family's wedding
CREATE OR REPLACE FUNCTION public.create_inquiry(p_user_id uuid, p_vendor_id uuid, p_event_slugs text[], p_event_date date, p_start_time time without time zone, p_guest_band text, p_location text, p_message text, p_preferred_contact text, p_language text, p_details jsonb, p_sender_name text, p_sender_phone text, p_sender_email text, p_send_again boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_vendor record;
  v_private record;
  v_previous timestamptz;
  v_hourly integer;
  v_daily integer;
  v_status text;
  v_channel text;
  v_id uuid;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  -- One request at a time per person, so two taps can't slip past the limits
  perform pg_advisory_xact_lock(hashtextextended('inquiry:' || p_user_id::text, 0));

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.adult_confirmed_at is not null
  ) then
    return jsonb_build_object('outcome', 'needs_profile');
  end if;

  select v.id, v.name, v.call_phone, v.text_phone, v.whatsapp_phone into v_vendor
  from public.vendors v
  where v.id = p_vendor_id and v.status = 'published';
  if not found then
    return jsonb_build_object('outcome', 'vendor_not_found');
  end if;

  if exists (
    select 1 from unnest(coalesce(p_event_slugs, '{}')) as s (slug)
    where not exists (select 1 from public.events e where e.slug = s.slug)
  ) or cardinality(coalesce(p_event_slugs, '{}')) > 10 then
    return jsonb_build_object('outcome', 'invalid', 'field', 'eventSlugs');
  end if;

  if p_event_date is not null and p_event_date < v_today then
    return jsonb_build_object('outcome', 'invalid', 'field', 'eventDate');
  end if;

  select max(i.created_at) into v_previous
  from public.inquiries i
  where i.user_id = p_user_id and i.vendor_id = p_vendor_id
    and i.status <> 'failed' and i.created_at > now() - interval '24 hours';
  if v_previous is not null and not coalesce(p_send_again, false) then
    return jsonb_build_object('outcome', 'duplicate', 'previous_at', v_previous);
  end if;

  select
    count(*) filter (where i.created_at > now() - interval '1 hour'),
    count(*)
  into v_hourly, v_daily
  from public.inquiries i
  where i.user_id = p_user_id and i.status <> 'failed'
    and i.created_at > now() - interval '24 hours';
  if v_hourly >= 5 then
    return jsonb_build_object('outcome', 'rate_limited', 'limit', 'hour');
  end if;
  if v_daily >= 15 then
    return jsonb_build_object('outcome', 'rate_limited', 'limit', 'day');
  end if;

  select vp.email, vp.checks_email into v_private
  from public.vendor_private vp
  where vp.vendor_id = p_vendor_id;
  v_channel := case
    when v_private.email is not null and coalesce(v_private.checks_email, true) then 'email'
    else 'relay'
  end;

  v_status := case when public.inquiry_emails_left_today() <= 0 then 'queued' else 'sending' end;

  insert into public.inquiries (
    user_id, vendor_id, event_slugs, event_date, start_time, guest_band, location, message,
    preferred_contact, language, details, sender_name, sender_phone, sender_email, channel, status
  ) values (
    p_user_id, p_vendor_id, coalesce(p_event_slugs, '{}'), p_event_date, p_start_time,
    p_guest_band, btrim(p_location), btrim(p_message), p_preferred_contact,
    coalesce(p_language, 'en'), coalesce(p_details, '{}'), btrim(p_sender_name), p_sender_phone,
    p_sender_email, v_channel, v_status
  )
  returning id into v_id;

  -- Asking a vendor saves them under those events (S11 "On send")
  perform private.save_for(p_user_id, p_vendor_id, s.slug, 'inquiry')
  from unnest(case when cardinality(coalesce(p_event_slugs, '{}')) = 0 then array[null::text]
    else p_event_slugs end) as s (slug);

  return jsonb_build_object(
    'outcome', 'created',
    'inquiry_id', v_id,
    'status', v_status,
    'channel', v_channel,
    'vendor_name', v_vendor.name,
    'vendor_email', case when v_channel = 'email' then v_private.email end,
    'vendor_phone', coalesce(v_vendor.whatsapp_phone, v_vendor.text_phone, v_vendor.call_phone)
  );
end;
$function$;
