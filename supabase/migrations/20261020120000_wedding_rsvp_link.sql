-- One RSVP link for the whole wedding (#337; Kirat's call of 2026-10-19 in
-- #130). Besides each family's own link, a wedding has one link that's the
-- same for everyone, for group texts, WhatsApp groups and emails. A guest
-- opens it, types their phone number (or email, for a family listed without
-- a phone) and gets their family's own RSVP page. The owner or an editor can
-- turn the link off or replace it. Misses are counted per link and day, so
-- the link can't be used to test phone numbers one after another.

alter table public.weddings
  add column rsvp_token text unique default replace(gen_random_uuid()::text, '-', '')
    check (rsvp_token ~ '^[0-9a-f]{32}$');

comment on column public.weddings.rsvp_token is
  'The wedding''s own RSVP link, the same for everyone (/rsvp/w/{token}); null while it''s turned off. Guests find their family''s RSVP with rsvp_find().';

create table public.rsvp_lookups (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  day date not null,
  misses integer not null default 0,
  primary key (wedding_id, day)
);

comment on table public.rsvp_lookups is
  'How many times a day the wedding''s RSVP link was tried with a number or email not on the list. Server side only: rsvp_find() writes it and stops at 20.';

alter table public.rsvp_lookups enable row level security;
revoke all on public.rsvp_lookups from anon, authenticated;

-- The owner or an editor turns the wedding's link on (keeping it if it's on),
-- off, or replaces it with a new one. Returns the link's token, or null when off.
create function private.set_wedding_rsvp_link(p_wedding_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('on', 'off', 'new') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  update public.weddings
  set rsvp_token = case p_action
    when 'off' then null
    when 'new' then replace(gen_random_uuid()::text, '-', '')
    else coalesce(rsvp_token, replace(gen_random_uuid()::text, '-', ''))
  end
  where id = p_wedding_id
  returning rsvp_token into token;
  return token;
end;
$$;

create function public.set_wedding_rsvp_link(p_wedding_id uuid, p_action text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.set_wedding_rsvp_link(p_wedding_id, p_action);
$$;

comment on function public.set_wedding_rsvp_link is
  'Owner and editors: turn the wedding''s RSVP link on (keeps the current one), off, or new (replaces it). Returns its token, or null when off. Errors: not_allowed, invalid_action.';

-- A guest on the wedding's link types their phone number or email and gets
-- their family's own RSVP token (null when they're not on the list). Works
-- logged out. After 20 misses in a day the link waits until tomorrow.
create function private.rsvp_find(p_token text, p_contact text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  w_id uuid;
  contact text := lower(btrim(coalesce(p_contact, '')));
  found_token text;
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  select w.id into w_id from public.weddings w where w.rsvp_token = lower(btrim(p_token));
  if not found then
    raise exception 'rsvp_not_found' using errcode = 'P0002';
  end if;
  if contact = '' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.rsvp_lookups l
    where l.wedding_id = w_id and l.day = today and l.misses >= 20
  ) then
    raise exception 'find_limit' using errcode = 'P0001';
  end if;
  -- A number as people type it, "(530) 555-0201", becomes the list's E.164
  -- shortcut: US numbers only; add the country when the app leaves California
  if position('@' in contact) = 0 then
    contact := regexp_replace(contact, '[^0-9+]', '', 'g');
    if contact ~ '^[0-9]{10}$' then
      contact := '+1' || contact;
    elsif contact ~ '^1[0-9]{10}$' then
      contact := '+' || contact;
    end if;
  end if;
  select g.rsvp_token into found_token
  from public.wedding_guests g
  where g.wedding_id = w_id and (g.phone = contact or g.email = contact)
  order by g.created_at
  limit 1;
  if found_token is null then
    insert into public.rsvp_lookups as l (wedding_id, day, misses)
    values (w_id, today, 1)
    on conflict (wedding_id, day) do update set misses = l.misses + 1;
  end if;
  return found_token;
end;
$$;

create function public.rsvp_find(p_token text, p_contact text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.rsvp_find(p_token, p_contact);
$$;

comment on function public.rsvp_find is
  'On the wedding''s RSVP link, logged out: the family''s own RSVP token for a phone number (any spacing) or email on the guest list, or null. Errors: rsvp_not_found (no such link), invalid_contact, find_limit (20 misses a day).';

revoke all on function private.set_wedding_rsvp_link, private.rsvp_find from public;
grant execute on function private.set_wedding_rsvp_link to authenticated;
grant execute on function private.rsvp_find to anon, authenticated;
revoke all on function public.set_wedding_rsvp_link, public.rsvp_find from public;
grant execute on function public.set_wedding_rsvp_link to authenticated;
grant execute on function public.rsvp_find to anon, authenticated;
