-- Guest list and per-event RSVP (#130; the scope is Kirat's comment on the
-- issue, 2026-10-19).
--
-- wedding_guests      The people a family invites (a person or a household):
--                     a name, an optional phone (E.164) and email, how many
--                     people the invite is for, and one unguessable RSVP token.
-- guest_lists         Named lists ("Mehndi list", "Mom's side").
-- guest_list_members  Which guests are on which list.
-- guest_invites       The events each guest is invited to, with their answer
--                     (pending, yes or no), how many are coming and when.
-- invite_sends        Each time an invitation went out (text or email), so the
--                     app can say "Sent Oct 19" and who hasn't had one yet.
-- The owner and editors can now set an event's times and place (the columns
-- came with the wedding plan restructure) for the RSVP page and the
-- invitation cards (#129).
--
-- This is other people's contact data: only the owner and editors read it,
-- every write goes through the functions below, it goes when the wedding
-- does, and it never holds a whole address book (500 guests at a time, 1,000
-- per wedding). Guests answer logged out with their token (rsvp_preview, rsvp).

-- Tables ------------------------------------------------------------------------------

-- Like the date: the policies already limit changes to the owner and editors
grant update (starts_at, ends_at, venue_id, venue_text) on public.wedding_events to authenticated;

create table public.wedding_guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  party_size smallint not null default 1 check (party_size between 1 and 20),
  -- 122 random bits as 32 hex characters: unguessable, safe in a URL
  rsvp_token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (rsvp_token ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wedding_guests is
  'The people a wedding invites. Owner and editors only; written with add_guests, update_guest and remove_guest.';
comment on column public.wedding_guests.party_size is
  'How many people the invite is for (a household counts as one guest).';

create index wedding_guests_wedding_idx on public.wedding_guests (wedding_id);
-- Adding the same contact twice keeps one guest
create unique index wedding_guests_one_per_phone on public.wedding_guests (wedding_id, phone)
  where phone is not null;

create table public.guest_lists (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guest_lists is
  'Named lists of guests ("Mehndi list", "Mom''s side"), to invite a whole list to an event.';

create unique index guest_lists_name_idx on public.guest_lists (wedding_id, lower(name));

create table public.guest_list_members (
  list_id uuid not null references public.guest_lists (id) on delete cascade,
  guest_id uuid not null references public.wedding_guests (id) on delete cascade,
  primary key (list_id, guest_id)
);

create index guest_list_members_guest_idx on public.guest_list_members (guest_id);

create table public.guest_invites (
  guest_id uuid not null references public.wedding_guests (id) on delete cascade,
  wedding_id uuid not null,
  wedding_event_id uuid not null,
  rsvp text not null default 'pending' check (rsvp in ('pending', 'yes', 'no')),
  coming smallint,
  answered_at timestamptz,
  answer_count smallint not null default 0 check (answer_count >= 0),
  created_at timestamptz not null default now(),
  primary key (guest_id, wedding_event_id),
  constraint guest_invites_wedding_event_fkey foreign key (wedding_id, wedding_event_id)
    references public.wedding_events (wedding_id, id) on delete cascade,
  check (case rsvp when 'pending' then coming is null when 'no' then coming = 0 else coming between 1 and 20 end)
);

comment on table public.guest_invites is
  'The events a guest is invited to and their RSVP. Written with invite_to_event and rsvp; removing the event removes its invites.';
comment on column public.guest_invites.coming is
  'How many of the party are coming: null while pending, 0 for no.';

create index guest_invites_wedding_event_idx on public.guest_invites (wedding_id, wedding_event_id);

create table public.invite_sends (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.wedding_guests (id) on delete cascade,
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  channel text not null check (channel in ('text', 'email')),
  sent_at timestamptz not null default now()
);

comment on table public.invite_sends is
  'Each invitation sent to a guest (by text or email), written with log_invite_sends.';

create index invite_sends_guest_idx on public.invite_sends (guest_id, sent_at desc);
create index invite_sends_wedding_idx on public.invite_sends (wedding_id, sent_at);

create trigger set_updated_at before update on public.wedding_guests
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.guest_lists
  for each row execute function private.set_updated_at();

-- Access: the owner and editors read; nobody writes except through the functions --------

alter table public.wedding_guests enable row level security;
alter table public.guest_lists enable row level security;
alter table public.guest_list_members enable row level security;
alter table public.guest_invites enable row level security;
alter table public.invite_sends enable row level security;

create policy "Owners and editors read the guests" on public.wedding_guests
  for select to authenticated
  using (private.can_edit_wedding(wedding_id));
create policy "Owners and editors read the guest lists" on public.guest_lists
  for select to authenticated
  using (private.can_edit_wedding(wedding_id));
create policy "Owners and editors read who is on each list" on public.guest_list_members
  for select to authenticated
  using (exists (select 1 from public.guest_lists l where l.id = list_id));
create policy "Owners and editors read the RSVPs" on public.guest_invites
  for select to authenticated
  using (private.can_edit_wedding(wedding_id));
create policy "Owners and editors read what was sent" on public.invite_sends
  for select to authenticated
  using (private.can_edit_wedding(wedding_id));

revoke all on public.wedding_guests, public.guest_lists, public.guest_list_members,
  public.guest_invites, public.invite_sends
  from anon, authenticated;
grant select on public.wedding_guests, public.guest_lists, public.guest_list_members,
  public.guest_invites, public.invite_sends
  to authenticated;

-- Guests (security definer in private, invoker wrappers in public) ------------------------

-- Add guests in one go (from the phone's contacts or typed in): a JSON array
-- of {name, phone, email, party_size}. A phone already on the list keeps its
-- guest as is. Returns the ids of the guests given, new or already there.
create function private.add_guests(p_wedding_id uuid, p_guests jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_guests) is distinct from 'array' or jsonb_array_length(p_guests) = 0 then
    raise exception 'invalid_guests' using errcode = '22023';
  end if;
  if jsonb_array_length(p_guests) > 500 then
    raise exception 'too_many_guests' using errcode = '22023';
  end if;

  with given as (
    select
      btrim(g ->> 'name') as name,
      nullif(btrim(g ->> 'phone'), '') as phone,
      lower(nullif(btrim(g ->> 'email'), '')) as email,
      coalesce((g ->> 'party_size')::smallint, 1) as party_size,
      n
    from jsonb_array_elements(p_guests) with ordinality as t (g, n)
  ),
  -- The same phone twice in one batch is one guest (an upsert can't touch a row twice)
  one_each as (
    select distinct on (coalesce(phone, n::text)) * from given
    order by coalesce(phone, n::text), n
  ),
  saved as (
    insert into public.wedding_guests (wedding_id, name, phone, email, party_size)
    select p_wedding_id, name, phone, email, party_size from one_each
    -- A no-op update, so returning also gives the guests already there
    on conflict (wedding_id, phone) where phone is not null do update set phone = excluded.phone
    returning id
  )
  select array_agg(id) into ids from saved;

  -- Counted after the insert, so contacts already on the list don't count twice
  if (select count(*) from public.wedding_guests where wedding_id = p_wedding_id) > 1000 then
    raise exception 'guest_limit' using errcode = 'P0001';
  end if;
  return ids;
end;
$$;

create function public.add_guests(p_wedding_id uuid, p_guests jsonb)
returns uuid[]
language sql
security invoker
set search_path = ''
as $$
  select private.add_guests(p_wedding_id, p_guests);
$$;

comment on function public.add_guests is
  'Owner and editors: add up to 500 guests ([{name, phone, email, party_size}]); a phone already on the list is not added twice. Returns their ids. Errors: not_allowed, invalid_guests, too_many_guests, guest_limit (1,000 per wedding), and check violations for a bad name, phone, email or party size.';

create function private.update_guest(
  p_guest_id uuid, p_name text, p_phone text, p_email text, p_party_size integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wedding_guests
  set name = btrim(p_name),
      phone = nullif(btrim(p_phone), ''),
      email = lower(nullif(btrim(p_email), '')),
      party_size = p_party_size
  where id = p_guest_id and private.can_edit_wedding(wedding_id);
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.update_guest(
  p_guest_id uuid, p_name text, p_phone text default null, p_email text default null,
  p_party_size integer default 1
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_guest(p_guest_id, p_name, p_phone, p_email, p_party_size);
$$;

comment on function public.update_guest is
  'Owner and editors: change a guest''s name, phone, email and party size (all of them; empty clears phone and email). Errors: not_allowed, a unique violation when the phone belongs to another guest, check violations.';

-- Removing a guest takes them off every list and invite. Removing one that's
-- already gone does nothing.
create function private.remove_guest(p_guest_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.wedding_guests
  where id = p_guest_id and private.can_edit_wedding(wedding_id);
$$;

create function public.remove_guest(p_guest_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_guest(p_guest_id);
$$;

comment on function public.remove_guest is
  'Owner and editors: remove a guest, with their list places, invites and sends.';

-- Lists ---------------------------------------------------------------------------------

create function private.create_guest_list(p_wedding_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.guest_lists where wedding_id = p_wedding_id) >= 50 then
    raise exception 'list_limit' using errcode = 'P0001';
  end if;
  insert into public.guest_lists (wedding_id, name)
  values (p_wedding_id, btrim(p_name))
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'list_name_taken' using errcode = '23505';
end;
$$;

create function public.create_guest_list(p_wedding_id uuid, p_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_guest_list(p_wedding_id, p_name);
$$;

comment on function public.create_guest_list is
  'Owner and editors: start a named guest list. Errors: not_allowed, list_limit (50), list_name_taken (any case).';

create function private.rename_guest_list(p_list_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guest_lists set name = btrim(p_name)
  where id = p_list_id and private.can_edit_wedding(wedding_id);
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
exception when unique_violation then
  raise exception 'list_name_taken' using errcode = '23505';
end;
$$;

create function public.rename_guest_list(p_list_id uuid, p_name text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.rename_guest_list(p_list_id, p_name);
$$;

comment on function public.rename_guest_list is
  'Owner and editors: rename a guest list. Errors: not_allowed, list_name_taken.';

create function private.delete_guest_list(p_list_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.guest_lists
  where id = p_list_id and private.can_edit_wedding(wedding_id);
$$;

create function public.delete_guest_list(p_list_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_guest_list(p_list_id);
$$;

comment on function public.delete_guest_list is
  'Owner and editors: delete a guest list. The guests stay, and so do their invites.';

-- Make a list hold exactly these guests. Ids that aren't this wedding's guests are ignored.
create function private.set_guest_list_members(p_list_id uuid, p_guest_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  list_wedding uuid;
begin
  select wedding_id into list_wedding from public.guest_lists where id = p_list_id;
  if list_wedding is null or not private.can_edit_wedding(list_wedding) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.guest_list_members
  where list_id = p_list_id and guest_id <> all(coalesce(p_guest_ids, '{}'));
  insert into public.guest_list_members (list_id, guest_id)
  select p_list_id, g.id from public.wedding_guests g
  where g.wedding_id = list_wedding and g.id = any(coalesce(p_guest_ids, '{}'))
  on conflict do nothing;
end;
$$;

create function public.set_guest_list_members(p_list_id uuid, p_guest_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_guest_list_members(p_list_id, p_guest_ids);
$$;

comment on function public.set_guest_list_members is
  'Owner and editors: make a list hold exactly these guests (others of the wedding''s are ignored). Errors: not_allowed.';

-- Invites and RSVPs ---------------------------------------------------------------------

-- Invite guests, a whole list, or both to one of the wedding's events. Guests
-- already invited keep their answer. Returns how many were newly invited.
create function private.invite_to_event(
  p_wedding_id uuid, p_event_slug text, p_guest_ids uuid[], p_list_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  added integer;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select we.id into event_id from public.wedding_events we
  where we.wedding_id = p_wedding_id and we.event_slug = p_event_slug;
  if event_id is null then
    raise exception 'event_not_in_plan' using errcode = 'P0002';
  end if;
  insert into public.guest_invites (guest_id, wedding_id, wedding_event_id)
  select g.id, p_wedding_id, event_id
  from public.wedding_guests g
  -- Only this wedding's guests, whatever ids or list were passed
  where g.wedding_id = p_wedding_id
    and (g.id = any(coalesce(p_guest_ids, '{}'))
         or g.id in (select m.guest_id from public.guest_list_members m where m.list_id = p_list_id))
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

create function public.invite_to_event(
  p_wedding_id uuid, p_event_slug text, p_guest_ids uuid[] default '{}', p_list_id uuid default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.invite_to_event(p_wedding_id, p_event_slug, p_guest_ids, p_list_id);
$$;

comment on function public.invite_to_event is
  'Owner and editors: invite guests and/or everyone on a list to an event. Returns how many were newly invited. Errors: not_allowed, event_not_in_plan.';

-- What a guest sees on the RSVP page, logged out: the couple, their own name
-- and party size, and only the events they're invited to (one row each, with
-- their answer so far). One row with no event when they're invited to
-- nothing yet; no rows for an unknown token.
create function private.rsvp_preview(p_token text)
returns table (
  title text, wedding_date date, guest_name text, party_size smallint,
  event_slug text, event_date date, starts_at time, ends_at time, place text,
  rsvp text, coming smallint, answered_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.title, w.wedding_date, g.name, g.party_size,
    e.event_slug, e.event_date, e.starts_at, e.ends_at,
    -- A listed hall or gurdwara by its name, else what the family typed
    coalesce(v.name, e.venue_text),
    i.rsvp, i.coming, i.answered_at
  from public.wedding_guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.guest_invites i on i.guest_id = g.id
  left join public.wedding_events e on e.id = i.wedding_event_id
  left join public.vendors v on v.id = e.venue_id
  where g.rsvp_token = lower(btrim(p_token))
  order by e.event_date nulls last, e.starts_at nulls last, e.event_slug;
$$;

create function public.rsvp_preview(p_token text)
returns table (
  title text, wedding_date date, guest_name text, party_size smallint,
  event_slug text, event_date date, starts_at time, ends_at time, place text,
  rsvp text, coming smallint, answered_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.rsvp_preview(p_token);
$$;

comment on function public.rsvp_preview is
  'The RSVP page, logged out: the wedding title and date, the guest''s name and party size, and one row per event they''re invited to (date, times, place, answer). Empty for an unknown token.';

-- A guest answers for one event: yes with how many are coming (all of the
-- party when not given), or no. Works logged out with the token; the couple
-- can answer for someone who called them, with the same token.
create function private.rsvp(p_token text, p_event_slug text, p_answer text, p_coming integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  guest public.wedding_guests;
  inv public.guest_invites;
  how_many integer;
begin
  select * into guest from public.wedding_guests where rsvp_token = lower(btrim(p_token));
  if not found then
    raise exception 'rsvp_not_found' using errcode = 'P0002';
  end if;
  select i.* into inv from public.guest_invites i
  join public.wedding_events e on e.id = i.wedding_event_id
  where i.guest_id = guest.id and e.event_slug = p_event_slug
  for update of i;
  if not found then
    raise exception 'not_invited' using errcode = 'P0002';
  end if;
  if p_answer is null or p_answer not in ('yes', 'no') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;
  how_many := case when p_answer = 'no' then 0 else coalesce(p_coming, guest.party_size) end;
  if p_answer = 'yes' and how_many not between 1 and guest.party_size then
    raise exception 'invalid_count' using errcode = '22023';
  end if;
  -- Saying the same thing again changes nothing and doesn't count
  if inv.rsvp = p_answer and inv.coming = how_many then
    return;
  end if;
  -- The page is public, so a link can't be used to rewrite an answer endlessly
  if inv.answer_count >= 50 then
    raise exception 'rsvp_limit' using errcode = 'P0001';
  end if;
  update public.guest_invites
  set rsvp = p_answer, coming = how_many, answered_at = now(), answer_count = answer_count + 1
  where guest_id = guest.id and wedding_event_id = inv.wedding_event_id;
end;
$$;

create function public.rsvp(p_token text, p_event_slug text, p_answer text, p_coming integer default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.rsvp(p_token, p_event_slug, p_answer, p_coming);
$$;

comment on function public.rsvp is
  'Answer an invitation to one event with the guest''s token (works logged out): yes with how many are coming (default the whole party) or no. Errors: rsvp_not_found, not_invited, invalid_answer, invalid_count, rsvp_limit (50 changes per event).';

-- For every event in the plan: guests (households) invited, how many said yes,
-- no or haven't answered, and the people invited and coming.
create function private.guest_summary(p_wedding_id uuid)
returns table (
  event_slug text, invited integer, yes integer, no integer, pending integer,
  people_invited integer, coming integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.event_slug,
    count(i.guest_id)::integer,
    count(*) filter (where i.rsvp = 'yes')::integer,
    count(*) filter (where i.rsvp = 'no')::integer,
    count(*) filter (where i.rsvp = 'pending')::integer,
    coalesce(sum(g.party_size), 0)::integer,
    coalesce(sum(i.coming), 0)::integer
  from public.wedding_events e
  left join public.guest_invites i on i.wedding_event_id = e.id
  left join public.wedding_guests g on g.id = i.guest_id
  where e.wedding_id = p_wedding_id and private.can_edit_wedding(p_wedding_id)
  group by e.id
  order by e.event_date nulls last, e.starts_at nulls last, e.event_slug;
$$;

create function public.guest_summary(p_wedding_id uuid)
returns table (
  event_slug text, invited integer, yes integer, no integer, pending integer,
  people_invited integer, coming integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.guest_summary(p_wedding_id);
$$;

comment on function public.guest_summary is
  'Owner and editors: per event, guests invited and how many said yes, no or haven''t answered, with people invited and coming. Empty for anyone else.';

-- Note that invitations went out (the app sends them from the phone, by text
-- or email). At most 500 at a time and 2,000 a day per wedding.
create function private.log_invite_sends(p_wedding_id uuid, p_guest_ids uuid[], p_channel text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  logged integer;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_channel is null or p_channel not in ('text', 'email') then
    raise exception 'invalid_channel' using errcode = '22023';
  end if;
  if cardinality(p_guest_ids) > 500 then
    raise exception 'too_many_guests' using errcode = '22023';
  end if;
  insert into public.invite_sends (guest_id, wedding_id, channel)
  select g.id, p_wedding_id, p_channel
  from public.wedding_guests g
  where g.wedding_id = p_wedding_id and g.id = any(coalesce(p_guest_ids, '{}'));
  get diagnostics logged = row_count;
  if (select count(*) from public.invite_sends
      where wedding_id = p_wedding_id and sent_at > now() - interval '1 day') > 2000 then
    raise exception 'send_limit' using errcode = 'P0001';
  end if;
  return logged;
end;
$$;

create function public.log_invite_sends(p_wedding_id uuid, p_guest_ids uuid[], p_channel text)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.log_invite_sends(p_wedding_id, p_guest_ids, p_channel);
$$;

comment on function public.log_invite_sends is
  'Owner and editors: note that invitations were sent to these guests by text or email. Returns how many. Errors: not_allowed, invalid_channel, too_many_guests (500), send_limit (2,000 a day).';

revoke all on function
  private.add_guests, private.update_guest, private.remove_guest, private.create_guest_list,
  private.rename_guest_list, private.delete_guest_list, private.set_guest_list_members,
  private.invite_to_event, private.rsvp_preview, private.rsvp, private.guest_summary,
  private.log_invite_sends
  from public;
grant execute on function
  private.add_guests, private.update_guest, private.remove_guest, private.create_guest_list,
  private.rename_guest_list, private.delete_guest_list, private.set_guest_list_members,
  private.invite_to_event, private.guest_summary, private.log_invite_sends
  to authenticated;
grant execute on function private.rsvp_preview, private.rsvp to anon, authenticated;

revoke all on function
  public.add_guests, public.update_guest, public.remove_guest, public.create_guest_list,
  public.rename_guest_list, public.delete_guest_list, public.set_guest_list_members,
  public.invite_to_event, public.rsvp_preview, public.rsvp, public.guest_summary,
  public.log_invite_sends
  from public;
grant execute on function
  public.add_guests, public.update_guest, public.remove_guest, public.create_guest_list,
  public.rename_guest_list, public.delete_guest_list, public.set_guest_list_members,
  public.invite_to_event, public.guest_summary, public.log_invite_sends
  to authenticated;
grant execute on function public.rsvp_preview, public.rsvp to anon, authenticated;
