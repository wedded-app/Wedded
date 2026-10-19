-- Memory Vault (#306; the screens are #307): guests at a wedding add the photos
-- and videos they took to the couple's private shared album. They join from a
-- link or the QR card on the tables, which brings them into the app, and the
-- couple sees everything, sorted by event.
--
-- memory_vaults   One per wedding, opened by an owner or editor, with the
--                 couple's settings: uploads open or locked, whether guests
--                 see everyone's photos or only their own, and whether guests
--                 see the vendors the family booked.
-- vault_guests    People who joined with a link. They're in the vault only:
--                 never the plan, the family chats or anything else of the
--                 wedding's.
-- vault_invites   The join link, like group_invites, but it may be printed on
--                 the tables and used for weeks: 180 days, 2000 uses.
-- vault_items     A photo or a video: who added it, its event and its files.
--
-- Who's in a vault: everyone in wedding_members, plus its guests.
-- * The couple (owner or editor) sees everything, hides or deletes any item,
--   changes the settings, makes and revokes the link, removes guests, and can
--   still add once uploads are locked.
-- * Family (suggesters) see everything not hidden and add while it's open.
-- * Guests add while it's open, delete their own, and see their own plus,
--   when the couple allows it (the default), everyone's not hidden.
-- * A hidden item is seen only by the couple and the person who added it.
-- * Vendors and strangers see nothing.
--
-- Files live in the private vault-media bucket as <vault id>/<user id>/<item
-- id>/ (photo.jpg or video.mp4 / video.mov, and thumb.jpg), uploaded by the
-- phone before add_vault_item() saves the item, and read through signed links.
-- Deleting an item, the wedding or an account removes the rows; every hour the
-- clear-vault-files function deletes the files no item points to any more
-- (and uploads that were never saved).

-- Tables ------------------------------------------------------------------------------

create table public.memory_vaults (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null unique references public.weddings (id) on delete cascade,
  uploads_open boolean not null default true,
  guests_see_all boolean not null default true,
  show_vendors boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.memory_vaults is
  'A wedding''s Memory Vault (#306): the shared album guests add their photos and videos to. One per wedding; read by the people in it (private.vault_role).';
comment on column public.memory_vaults.uploads_open is
  'False once the couple locks the vault: only the couple can still add.';
comment on column public.memory_vaults.guests_see_all is
  'Whether guests see everyone''s photos and videos (true) or only their own.';
comment on column public.memory_vaults.show_vendors is
  'Whether guests see the vendors the family booked ("The vendors who made this day").';

create index memory_vaults_created_by_idx on public.memory_vaults (created_by);

create table public.vault_guests (
  vault_id uuid not null references public.memory_vaults (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (vault_id, user_id)
);

comment on table public.vault_guests is
  'People who joined a Memory Vault with its link. Added only by accept_vault_invite; the wedding''s own members are in it without a row here.';

create index vault_guests_user_idx on public.vault_guests (user_id);

create table public.vault_invites (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.memory_vaults (id) on delete cascade,
  -- 122 random bits as 32 hex characters: unguessable, safe in a URL
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'),
  -- Kept when its maker deletes their account: the link may be on printed cards
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  revoked_at timestamptz,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer not null default 2000 check (max_uses between 1 and 5000)
);

comment on table public.vault_invites is
  'Join links for a Memory Vault. create_vault_invite hands out the open one, vault_invite_preview shows it before joining, accept_vault_invite uses it.';

create index vault_invites_vault_idx on public.vault_invites (vault_id);
create index vault_invites_created_by_idx on public.vault_invites (created_by);

create table public.vault_items (
  -- Made on the phone, which uploads the files to <vault>/<user>/<id>/ first
  id uuid primary key,
  vault_id uuid not null references public.memory_vaults (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  path text not null unique,
  thumb_path text unique,
  -- Not tied to wedding_events: an event taken off the plan and put back
  -- finds its photos again
  event_slug text references public.events (slug) on update cascade on delete set null,
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  duration_ms integer check (duration_ms between 1 and 61000),
  taken_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  constraint vault_items_photo_has_no_duration check (kind = 'video' or duration_ms is null)
);

comment on table public.vault_items is
  'Photos and videos in a Memory Vault. Read through vault_items(); written only by add_vault_item, remove_vault_item and hide_vault_item.';
comment on column public.vault_items.hidden_at is
  'Set when the couple hides an item: then only the couple and the person who added it see it.';

create index vault_items_vault_created_idx on public.vault_items (vault_id, created_at desc, id desc);
create index vault_items_user_vault_idx on public.vault_items (user_id, vault_id);
create index vault_items_event_slug_idx on public.vault_items (event_slug);

-- Helpers ------------------------------------------------------------------------------

-- How the caller is in a vault: couple (an owner or editor of its wedding),
-- family (a suggester), guest (joined with a link), or null.
create function private.vault_role(p_vault_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.wedding_role(v.wedding_id) in ('owner', 'editor') then 'couple'
    when private.wedding_role(v.wedding_id) is not null then 'family'
    when exists (
      select 1 from public.vault_guests g
      where g.vault_id = v.id and g.user_id = (select auth.uid())
    ) then 'guest'
  end
  from public.memory_vaults v
  where v.id = p_vault_id;
$$;

comment on function private.vault_role is
  'How the caller is in a Memory Vault: couple (owner or editor of the wedding), family (suggester), guest (joined with a link) or null.';

-- Whether someone in a vault as p_role sees an item: the couple sees all, the
-- one who added it always does, nobody else sees a hidden one, and guests see
-- other people's only when the couple allows it.
create function private.vault_item_visible(
  p_role text,
  p_guests_see_all boolean,
  p_me uuid,
  p_added_by uuid,
  p_hidden boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_role = 'couple' then true
    when p_role is null then false
    when p_added_by = p_me then true
    when p_hidden then false
    when p_role = 'family' then true
    else coalesce(p_guests_see_all, false)
  end;
$$;

create function private.can_see_vault_item(p_vault_id uuid, p_added_by uuid, p_hidden boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.vault_item_visible(
    private.vault_role(p_vault_id),
    (select v.guests_see_all from public.memory_vaults v where v.id = p_vault_id),
    (select auth.uid()),
    p_added_by,
    p_hidden
  );
$$;

comment on function private.can_see_vault_item is
  'Whether the caller sees an item of a Memory Vault. Used by RLS policies.';

-- The couple can always add; everyone else in the vault while it's open.
create function private.can_add_to_vault(p_vault_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case private.vault_role(v.id)
      when 'couple' then true
      when 'family' then v.uploads_open
      when 'guest' then v.uploads_open
      else false
    end
    from public.memory_vaults v
    where v.id = p_vault_id
  ), false);
$$;

comment on function private.can_add_to_vault is
  'Whether the caller can add to a Memory Vault: the couple always, others in it while uploads are open.';

-- Access ------------------------------------------------------------------------------

alter table public.memory_vaults enable row level security;
alter table public.vault_guests enable row level security;
alter table public.vault_invites enable row level security;
alter table public.vault_items enable row level security;

create policy "People in a vault read it" on public.memory_vaults
  for select to authenticated
  using (private.vault_role(id) is not null);

create policy "The couple sees the guests, and guests themselves" on public.vault_guests
  for select to authenticated
  using (user_id = (select auth.uid()) or private.vault_role(vault_id) = 'couple');

create policy "The couple sees the links" on public.vault_invites
  for select to authenticated
  using (private.vault_role(vault_id) = 'couple');

create policy "People read the items they may see" on public.vault_items
  for select to authenticated
  using (private.can_see_vault_item(vault_id, user_id, hidden_at is not null));

revoke all on public.memory_vaults, public.vault_guests, public.vault_invites, public.vault_items
  from anon, authenticated;
grant select on public.memory_vaults, public.vault_guests, public.vault_invites, public.vault_items
  to authenticated;

-- Files -------------------------------------------------------------------------------

-- 50 MB like reels: a minute of video the phone has exported at 720p or so.
-- Photos are shrunk on the phone first, so they're far smaller.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-media', 'vault-media', false, 50 * 1024 * 1024,
  array['image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Uploading: only into your own folder of a vault you can add to, and only
-- the files an item has.
create function private.can_upload_vault_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_name ~ ('^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){3}'
                   || '(photo\.jpg|video\.mp4|video\.mov|thumb\.jpg)$')
      then split_part(p_name, '/', 2) = (select auth.uid())::text
        and private.can_add_to_vault(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$;

-- Reading: your own uploads, and the files of items you may see.
create function private.can_read_vault_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_name ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){3}'
      then split_part(p_name, '/', 2) = (select auth.uid())::text
        or exists (
          select 1 from public.vault_items i
          where i.id = split_part(p_name, '/', 3)::uuid
            and i.vault_id = split_part(p_name, '/', 1)::uuid
            and p_name in (i.path, i.thumb_path)
            and private.can_see_vault_item(i.vault_id, i.user_id, i.hidden_at is not null)
        )
    else false
  end;
$$;

-- Deleting: only your own uploads that were never saved as an item (the app
-- tidies up after a failed save). Saved items go through remove_vault_item.
create function private.can_delete_vault_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_name ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/){3}'
      then split_part(p_name, '/', 2) = (select auth.uid())::text
        and not exists (
          select 1 from public.vault_items i where i.id = split_part(p_name, '/', 3)::uuid
        )
    else false
  end;
$$;

create policy "People in a vault upload to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault-media' and private.can_upload_vault_object(name));
create policy "Vault files are read by who may see them" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault-media' and private.can_read_vault_object(name));
create policy "People delete their own unsaved vault uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vault-media' and private.can_delete_vault_object(name));

-- RPCs (security definer in private, invoker wrappers in public) -------------------------

-- Open the wedding's vault (owners and editors). Opening it again returns it.
create function private.open_memory_vault(p_wedding_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null or not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.memory_vaults (wedding_id, created_by)
  values (p_wedding_id, (select auth.uid()))
  on conflict (wedding_id) do nothing;
  select v.id into new_id from public.memory_vaults v where v.wedding_id = p_wedding_id;
  return new_id;
end;
$$;

create function public.open_memory_vault(p_wedding_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.open_memory_vault(p_wedding_id);
$$;

comment on function public.open_memory_vault is
  'Open a wedding''s Memory Vault (owners and editors); returns its id, the same one when it''s already open. Errors: not_allowed.';

-- A vault as the caller sees it, by its id or its wedding's; no row when
-- there's no vault or the caller isn't in it. events: the wedding's events
-- with how many items each has that the caller sees.
create function private.memory_vault(p_vault_id uuid, p_wedding_id uuid)
returns table (
  id uuid,
  wedding_id uuid,
  title text,
  wedding_date date,
  my_role text,
  can_add boolean,
  uploads_open boolean,
  guests_see_all boolean,
  show_vendors boolean,
  item_count integer,
  my_item_count integer,
  guest_count integer,
  events jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select mv.id, mv.wedding_id, mv.uploads_open, mv.guests_see_all, mv.show_vendors,
      private.vault_role(mv.id) as role
    from public.memory_vaults mv
    where mv.id = coalesce(p_vault_id,
      (select x.id from public.memory_vaults x where x.wedding_id = p_wedding_id))
  ),
  seen as (
    select i.event_slug
    from v
    join public.vault_items i on i.vault_id = v.id
    where private.vault_item_visible(v.role, v.guests_see_all, (select auth.uid()), i.user_id,
      i.hidden_at is not null)
  )
  select
    v.id,
    v.wedding_id,
    w.title,
    w.wedding_date,
    v.role,
    v.role = 'couple' or v.uploads_open,
    v.uploads_open,
    v.guests_see_all,
    v.show_vendors,
    (select count(*)::integer from seen),
    (select count(*)::integer from public.vault_items i
     where i.vault_id = v.id and i.user_id = (select auth.uid())),
    (select count(*)::integer from public.vault_guests g where g.vault_id = v.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', we.event_slug,
        'name', e.name,
        'date', we.event_date,
        'count', (select count(*) from seen s where s.event_slug = we.event_slug)
      ) order by we.event_date nulls last, we.created_at, we.event_slug)
      from public.wedding_events we
      join public.events e on e.slug = we.event_slug
      where we.wedding_id = v.wedding_id
    ), '[]'::jsonb)
  from v
  join public.weddings w on w.id = v.wedding_id
  where v.role is not null;
$$;

create function public.memory_vault(p_vault_id uuid default null, p_wedding_id uuid default null)
returns table (
  id uuid,
  wedding_id uuid,
  title text,
  wedding_date date,
  my_role text,
  can_add boolean,
  uploads_open boolean,
  guests_see_all boolean,
  show_vendors boolean,
  item_count integer,
  my_item_count integer,
  guest_count integer,
  events jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.memory_vault(p_vault_id, p_wedding_id);
$$;

comment on function public.memory_vault is
  'A Memory Vault by its id or its wedding''s, as the caller sees it: the wedding''s title and date, the caller''s role (couple, family, guest), whether they can add, the settings, counts, and the wedding''s events with how many items each has ([{slug, name, date, count}]). No row when there''s none or the caller isn''t in it.';

-- The vault's join link (the couple): the open one, or a new one when there's
-- none with a month or more left.
create function private.create_vault_invite(p_vault_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  link text;
begin
  if private.vault_role(p_vault_id) is distinct from 'couple' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select i.token into link
  from public.vault_invites i
  where i.vault_id = p_vault_id
    and i.revoked_at is null
    and i.expires_at > now() + interval '30 days'
    and i.uses < i.max_uses
  order by i.created_at desc
  limit 1;
  if link is not null then
    return link;
  end if;
  if (select count(*) from public.vault_invites
      where vault_id = p_vault_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;
  insert into public.vault_invites (vault_id, created_by)
  values (p_vault_id, (select auth.uid()))
  returning token into link;
  return link;
end;
$$;

create function public.create_vault_invite(p_vault_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.create_vault_invite(p_vault_id);
$$;

comment on function public.create_vault_invite is
  'The Memory Vault''s join link token (the couple): the open one, or a new one (180 days, 2000 uses). Errors: not_allowed, invite_limit.';

-- Stop every open link (the couple), say when one reached the wrong people.
-- The next create_vault_invite makes a new one.
create function private.revoke_vault_invite(p_vault_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.vault_role(p_vault_id) is distinct from 'couple' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.vault_invites set revoked_at = now()
  where vault_id = p_vault_id and revoked_at is null;
end;
$$;

create function public.revoke_vault_invite(p_vault_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_vault_invite(p_vault_id);
$$;

comment on function public.revoke_vault_invite is
  'Stop the Memory Vault''s open links (the couple); people already in it stay. Errors: not_allowed.';

-- What someone sees before joining. Works logged out (the link opens from a
-- QR card or WhatsApp, often on the web). Only a valid link shows anything
-- beyond its status, and never the event dates.
create function private.vault_invite_preview(p_token text)
returns table (
  status text,
  vault_id uuid,
  title text,
  inviter_name text,
  events jsonb,
  item_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  inv public.vault_invites;
  link_status text;
begin
  select * into inv from public.vault_invites i where i.token = lower(btrim(p_token));
  link_status := case
    when not found then 'not_found'
    when inv.revoked_at is not null then 'revoked'
    when inv.expires_at <= now() then 'expired'
    when inv.uses >= inv.max_uses then 'used_up'
    else 'valid'
  end;
  if link_status <> 'valid' then
    return query select link_status, null::uuid, null::text, null::text, null::jsonb, null::integer;
    return;
  end if;
  return query
  select
    link_status,
    v.id,
    w.title,
    -- First name only
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    coalesce((
      select jsonb_agg(jsonb_build_object('slug', we.event_slug, 'name', e.name)
        order by we.event_date nulls last, we.created_at, we.event_slug)
      from public.wedding_events we
      join public.events e on e.slug = we.event_slug
      where we.wedding_id = v.wedding_id
    ), '[]'::jsonb),
    (select count(*)::integer from public.vault_items i
     where i.vault_id = v.id and i.hidden_at is null)
  from public.memory_vaults v
  join public.weddings w on w.id = v.wedding_id
  left join public.profiles p on p.id = inv.created_by
  where v.id = inv.vault_id;
end;
$$;

create function public.vault_invite_preview(p_token text)
returns table (
  status text,
  vault_id uuid,
  title text,
  inviter_name text,
  events jsonb,
  item_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vault_invite_preview(p_token);
$$;

comment on function public.vault_invite_preview is
  'Before joining a Memory Vault: the link''s status (valid, expired, used_up, revoked, not_found) and, only for a valid one, the vault''s id, the wedding''s title, the inviter''s first name, the event names ([{slug, name}]) and how many photos and videos are in it.';

-- Join a vault with its link. The wedding's own people are already in it, and
-- joining again is harmless.
create function private.accept_vault_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  inv public.vault_invites;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into inv from public.vault_invites i
  where i.token = lower(btrim(p_token))
  for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if private.vault_role(inv.vault_id) is not null then
    return inv.vault_id;
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  elsif inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  elsif inv.uses >= inv.max_uses then
    raise exception 'invite_used_up' using errcode = 'P0001';
  end if;
  if (select count(*) from public.vault_guests where user_id = caller) >= 50 then
    raise exception 'too_many_vaults' using errcode = 'P0001';
  end if;

  insert into public.vault_guests (vault_id, user_id) values (inv.vault_id, caller);
  update public.vault_invites set uses = uses + 1 where id = inv.id;
  return inv.vault_id;
end;
$$;

create function public.accept_vault_invite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_vault_invite(p_token);
$$;

comment on function public.accept_vault_invite is
  'Join a Memory Vault with a link token; returns the vault''s id. Errors: not_signed_in, invite_not_found, invite_revoked, invite_expired, invite_used_up, too_many_vaults.';

-- Leave (your own id) or, as the couple, remove a guest. What they added stays.
create function private.remove_vault_guest(p_vault_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is distinct from (select auth.uid())
    and private.vault_role(p_vault_id) is distinct from 'couple' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.vault_guests where vault_id = p_vault_id and user_id = p_user_id;
end;
$$;

create function public.remove_vault_guest(p_vault_id uuid, p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_vault_guest(p_vault_id, p_user_id);
$$;

comment on function public.remove_vault_guest is
  'Leave a Memory Vault (your own id) or, as the couple, remove a guest. Their photos and videos stay. Errors: not_allowed.';

-- Save an item whose files are uploaded: <vault>/<you>/<item>/photo.jpg or
-- video.mp4 / video.mov, and thumb.jpg if there is one.
create function private.add_vault_item(
  p_vault_id uuid,
  p_item_id uuid,
  p_kind text,
  p_path text,
  p_thumb_path text,
  p_event_slug text,
  p_width integer,
  p_height integer,
  p_duration_ms integer,
  p_taken_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  my_role text := private.vault_role(p_vault_id);
  target public.memory_vaults;
  folder text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into target from public.memory_vaults where id = p_vault_id;
  if my_role is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if my_role <> 'couple' and not target.uploads_open then
    raise exception 'uploads_locked' using errcode = 'P0001';
  end if;
  folder := p_vault_id::text || '/' || caller::text || '/' || coalesce(p_item_id::text, '') || '/';
  if p_item_id is null
    or not coalesce(
      (p_kind = 'photo' and p_path = folder || 'photo.jpg')
        or (p_kind = 'video' and p_path in (folder || 'video.mp4', folder || 'video.mov')),
      false)
    or (p_thumb_path is not null and p_thumb_path <> folder || 'thumb.jpg') then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  if coalesce(p_width, 0) not between 1 and 20000
    or coalesce(p_height, 0) not between 1 and 20000
    or (p_kind = 'video' and p_duration_ms is not null and p_duration_ms not between 1 and 61000) then
    raise exception 'invalid_size' using errcode = '22023';
  end if;
  if p_event_slug is not null and not exists (
    select 1 from public.wedding_events we
    where we.wedding_id = target.wedding_id and we.event_slug = p_event_slug
  ) then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  if (select count(*) from storage.objects o
      where o.bucket_id = 'vault-media' and o.name in (p_path, p_thumb_path))
    < (case when p_thumb_path is null then 1 else 2 end) then
    raise exception 'files_missing' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.vault_items where id = p_item_id) then
    raise exception 'already_added' using errcode = '23505';
  end if;
  if (select count(*) from public.vault_items where user_id = caller and vault_id = p_vault_id)
    >= (case when my_role = 'guest' then 300 else 2000 end) then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;
  if (select count(*) from public.vault_items where vault_id = p_vault_id) >= 20000 then
    raise exception 'vault_full' using errcode = 'P0001';
  end if;

  insert into public.vault_items
    (id, vault_id, user_id, kind, path, thumb_path, event_slug, width, height, duration_ms, taken_at)
  values (
    p_item_id, p_vault_id, caller, p_kind, p_path, p_thumb_path, p_event_slug, p_width, p_height,
    case when p_kind = 'video' then p_duration_ms end,
    -- A phone's clock can say anything; keep only a believable time
    case when p_taken_at between '2000-01-01'::timestamptz and now() + interval '1 day'
      then p_taken_at end
  );
  return p_item_id;
end;
$$;

create function public.add_vault_item(
  p_vault_id uuid,
  p_item_id uuid,
  p_kind text,
  p_path text,
  p_width integer,
  p_height integer,
  p_thumb_path text default null,
  p_event_slug text default null,
  p_duration_ms integer default null,
  p_taken_at timestamptz default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.add_vault_item(p_vault_id, p_item_id, p_kind, p_path, p_thumb_path, p_event_slug,
    p_width, p_height, p_duration_ms, p_taken_at);
$$;

comment on function public.add_vault_item is
  'Save a photo or video to a Memory Vault once its files are uploaded to <vault>/<you>/<item id>/ (photo.jpg, or video.mp4 / video.mov, and thumb.jpg). 300 a guest, 2000 for the wedding''s own people. Errors: not_signed_in, not_allowed, uploads_locked, invalid_file, invalid_size, invalid_event, files_missing, already_added, too_many_items, vault_full.';

-- Delete an item: the one who added it, or the couple. Its files go with the
-- next clear-vault-files run.
create function private.remove_vault_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.vault_items i
  where i.id = p_item_id
    and (i.user_id = (select auth.uid()) or private.vault_role(i.vault_id) = 'couple');
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.remove_vault_item(p_item_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_vault_item(p_item_id);
$$;

comment on function public.remove_vault_item is
  'Delete a photo or video from a Memory Vault (the one who added it, or the couple). Errors: not_allowed.';

-- Hide or show an item again (the couple).
create function private.hide_vault_item(p_item_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vault_items i
  set hidden_at = case when coalesce(p_hidden, true) then coalesce(i.hidden_at, now()) end
  where i.id = p_item_id and private.vault_role(i.vault_id) = 'couple';
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.hide_vault_item(p_item_id uuid, p_hidden boolean default true)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.hide_vault_item(p_item_id, p_hidden);
$$;

comment on function public.hide_vault_item is
  'Hide a photo or video (the couple; then only the couple and the person who added it see it), or show it again with p_hidden false. Errors: not_allowed.';

-- Change the settings (the couple); a null leaves that one as it is.
create function private.set_vault_settings(
  p_vault_id uuid,
  p_uploads_open boolean,
  p_guests_see_all boolean,
  p_show_vendors boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.vault_role(p_vault_id) is distinct from 'couple' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.memory_vaults
  set uploads_open = coalesce(p_uploads_open, uploads_open),
      guests_see_all = coalesce(p_guests_see_all, guests_see_all),
      show_vendors = coalesce(p_show_vendors, show_vendors)
  where id = p_vault_id;
end;
$$;

create function public.set_vault_settings(
  p_vault_id uuid,
  p_uploads_open boolean default null,
  p_guests_see_all boolean default null,
  p_show_vendors boolean default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_vault_settings(p_vault_id, p_uploads_open, p_guests_see_all, p_show_vendors);
$$;

comment on function public.set_vault_settings is
  'Change a Memory Vault''s settings (the couple): uploads open or locked, guests see everyone''s or only their own, show the booked vendors to guests. Null leaves one unchanged. Errors: not_allowed.';

-- The items the caller sees, newest first, a page at a time: pass the last
-- item's created_at and id for the next page. p_event_slug narrows to one event.
create function private.vault_items(
  p_vault_id uuid,
  p_event_slug text,
  p_before_at timestamptz,
  p_before_id uuid,
  p_limit integer
)
returns table (
  id uuid,
  user_id uuid,
  added_by_name text,
  is_mine boolean,
  kind text,
  path text,
  thumb_path text,
  event_slug text,
  width integer,
  height integer,
  duration_ms integer,
  taken_at timestamptz,
  hidden boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select mv.id, mv.guests_see_all, private.vault_role(mv.id) as role
    from public.memory_vaults mv
    where mv.id = p_vault_id
  )
  select
    i.id,
    i.user_id,
    -- First name only
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    i.user_id = (select auth.uid()),
    i.kind,
    i.path,
    i.thumb_path,
    i.event_slug,
    i.width,
    i.height,
    i.duration_ms,
    i.taken_at,
    i.hidden_at is not null,
    i.created_at
  from v
  join public.vault_items i on i.vault_id = v.id
  left join public.profiles p on p.id = i.user_id
  where private.vault_item_visible(v.role, v.guests_see_all, (select auth.uid()), i.user_id,
      i.hidden_at is not null)
    and (p_event_slug is null or i.event_slug = p_event_slug)
    and (p_before_at is null or (i.created_at, i.id) < (p_before_at, p_before_id))
  order by i.created_at desc, i.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

create function public.vault_items(
  p_vault_id uuid,
  p_event_slug text default null,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 60
)
returns table (
  id uuid,
  user_id uuid,
  added_by_name text,
  is_mine boolean,
  kind text,
  path text,
  thumb_path text,
  event_slug text,
  width integer,
  height integer,
  duration_ms integer,
  taken_at timestamptz,
  hidden boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vault_items(p_vault_id, p_event_slug, p_before_at, p_before_id, p_limit);
$$;

comment on function public.vault_items is
  'The photos and videos of a Memory Vault the caller sees, newest first, with the first name of who added each; up to 200 a page (pass the last one''s created_at and id for the next). Empty unless the caller is in it.';

-- The vaults the caller is in, the most recently added to first.
create function private.my_vaults()
returns table (
  id uuid,
  wedding_id uuid,
  title text,
  wedding_date date,
  my_role text,
  uploads_open boolean,
  item_count integer,
  my_item_count integer,
  last_item_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select v.id
    from public.memory_vaults v
    join public.wedding_members m on m.wedding_id = v.wedding_id
    where m.user_id = (select auth.uid())
    union
    select g.vault_id from public.vault_guests g where g.user_id = (select auth.uid())
  ),
  v as (
    select mv.*, private.vault_role(mv.id) as role
    from public.memory_vaults mv
    join mine on mine.id = mv.id
  )
  select
    v.id,
    v.wedding_id,
    w.title,
    w.wedding_date,
    v.role,
    v.uploads_open,
    seen.item_count,
    (select count(*)::integer from public.vault_items i
     where i.vault_id = v.id and i.user_id = (select auth.uid())),
    seen.last_item_at
  from v
  join public.weddings w on w.id = v.wedding_id
  cross join lateral (
    select count(*)::integer as item_count, max(i.created_at) as last_item_at
    from public.vault_items i
    where i.vault_id = v.id
      and private.vault_item_visible(v.role, v.guests_see_all, (select auth.uid()), i.user_id,
        i.hidden_at is not null)
  ) seen
  order by coalesce(seen.last_item_at, v.created_at) desc, v.id;
$$;

create function public.my_vaults()
returns table (
  id uuid,
  wedding_id uuid,
  title text,
  wedding_date date,
  my_role text,
  uploads_open boolean,
  item_count integer,
  my_item_count integer,
  last_item_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_vaults();
$$;

comment on function public.my_vaults is
  'The Memory Vaults the caller is in (their weddings'' and the ones they joined), most recently added to first: the wedding''s title and date, their role, whether uploads are open and how many items they see and added.';

-- The published vendors the family booked, for "The vendors who made this
-- day": always for the wedding's own people, for guests when the couple allows.
create function private.vault_vendors(p_vault_id uuid)
returns table (
  vendor_id uuid,
  slug text,
  name text,
  city text,
  is_sample boolean,
  category_slugs text[],
  event_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vd.id,
    vd.slug,
    vd.name,
    vd.city,
    vd.is_sample,
    array_agg(distinct b.category_slug order by b.category_slug),
    array_agg(distinct b.event_slug order by b.event_slug)
  from public.memory_vaults v
  join public.wedding_bookings b on b.wedding_id = v.wedding_id
  join public.vendors vd on vd.id = b.vendor_id and vd.status = 'published'
  where v.id = p_vault_id
    and case private.vault_role(v.id)
      when 'couple' then true
      when 'family' then true
      when 'guest' then v.show_vendors
      else false
    end
  group by vd.id, vd.slug, vd.name, vd.city, vd.is_sample
  order by vd.name, vd.id;
$$;

create function public.vault_vendors(p_vault_id uuid)
returns table (
  vendor_id uuid,
  slug text,
  name text,
  city text,
  is_sample boolean,
  category_slugs text[],
  event_slugs text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vault_vendors(p_vault_id);
$$;

comment on function public.vault_vendors is
  'The published vendors the family booked, with their vendor types and events: for the wedding''s own people, and for guests when the couple shows them. Empty otherwise.';

-- Clearing files (service role only) ----------------------------------------------------

-- Files no item points to any more: from deleted items, weddings and
-- accounts, and uploads never saved. Only ones over an hour old, so an upload
-- still on its way to add_vault_item is left alone.
create function public.orphan_vault_files(p_limit integer default 500)
returns table (name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'vault-media'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from public.vault_items i where i.path = o.name)
    and not exists (select 1 from public.vault_items i where i.thumb_path = o.name)
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

comment on function public.orphan_vault_files is
  'Service role only (clear-vault-files): files in vault-media over an hour old that no Memory Vault item points to, oldest first.';

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'clear-vault-files',
  '37 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/clear-vault-files',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.orphan_vault_files(1));
  $job$
);

-- Grants --------------------------------------------------------------------------------

revoke all on function
  private.vault_role, private.vault_item_visible, private.can_see_vault_item,
  private.can_add_to_vault, private.can_upload_vault_object, private.can_read_vault_object,
  private.can_delete_vault_object, private.open_memory_vault, private.memory_vault,
  private.create_vault_invite, private.revoke_vault_invite, private.vault_invite_preview,
  private.accept_vault_invite, private.remove_vault_guest, private.add_vault_item,
  private.remove_vault_item, private.hide_vault_item, private.set_vault_settings,
  private.vault_items, private.my_vaults, private.vault_vendors
  from public;
grant execute on function
  private.vault_role, private.vault_item_visible, private.can_see_vault_item,
  private.can_add_to_vault, private.can_upload_vault_object, private.can_read_vault_object,
  private.can_delete_vault_object, private.open_memory_vault, private.memory_vault,
  private.create_vault_invite, private.revoke_vault_invite, private.vault_invite_preview,
  private.accept_vault_invite, private.remove_vault_guest, private.add_vault_item,
  private.remove_vault_item, private.hide_vault_item, private.set_vault_settings,
  private.vault_items, private.my_vaults, private.vault_vendors
  to authenticated;
grant execute on function private.vault_invite_preview to anon;

revoke all on function
  public.open_memory_vault, public.memory_vault, public.create_vault_invite,
  public.revoke_vault_invite, public.vault_invite_preview, public.accept_vault_invite,
  public.remove_vault_guest, public.add_vault_item, public.remove_vault_item,
  public.hide_vault_item, public.set_vault_settings, public.vault_items, public.my_vaults,
  public.vault_vendors, public.orphan_vault_files
  from public, anon, authenticated;
grant execute on function
  public.open_memory_vault, public.memory_vault, public.create_vault_invite,
  public.revoke_vault_invite, public.vault_invite_preview, public.accept_vault_invite,
  public.remove_vault_guest, public.add_vault_item, public.remove_vault_item,
  public.hide_vault_item, public.set_vault_settings, public.vault_items, public.my_vaults,
  public.vault_vendors
  to authenticated;
grant execute on function public.vault_invite_preview to anon;
grant execute on function public.orphan_vault_files to service_role;
