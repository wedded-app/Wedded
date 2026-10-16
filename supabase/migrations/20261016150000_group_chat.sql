-- Group chat (A3, #126): family and friends planning a wedding together in a
-- thread, with Wed answering when someone tags @Wed (the brain is A1, #124;
-- the screen is A2, #125).
--
-- group_threads   A chat that belongs to a wedding ("Family", "Jaago crew").
--                 Up to 10 per wedding.
-- group_members   Who is in a thread, and when they last read it. A thread
--                 can hold friends who aren't members of the wedding.
-- group_invites   Join links shared in WhatsApp, like wedding_invites:
--                 unguessable token, 14 days, 20 uses, revocable.
-- group_messages  Text from members, Wed's answers (sender_role 'wed', only
--                 from the server) and joined / left lines.
--
-- Privacy rules:
-- * Only a thread's members read it, its messages and who is in it. Being in
--   the wedding isn't enough, so a cousins' thread stays the cousins'.
-- * Vendors never see group threads.
-- * Managing a thread (rename, add, remove, links) takes being in it and an
--   owner or editor of the wedding. Anyone can leave; the last one out
--   deletes the thread. People are added only from the wedding's members,
--   or join through a link. Leaving the wedding doesn't take anyone out of
--   its threads (friends outside the wedding can be in them too); managers
--   remove people from a thread themselves.
-- * Wed reads a thread only when tagged: claim_wed_asks() hands the brain the
--   question and the 20 messages before it, and whether everyone in the
--   thread is in the wedding, so private plan details (budget, notes) are
--   only said in front of the wedding's own people. Wed's answers come only
--   from post_wed_reply() (service role).
-- * Deleting an account deletes that person's messages and memberships;
--   leaving a thread keeps their messages for the others.

-- Tables ------------------------------------------------------------------------------

create table public.group_threads (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

comment on table public.group_threads is
  'Group chats of a wedding (A3, #126). Readable by the thread''s members only; see group_members.';

create index group_threads_wedding_idx on public.group_threads (wedding_id);
create index group_threads_created_by_idx on public.group_threads (created_by);

create table public.group_members (
  thread_id uuid not null references public.group_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (thread_id, user_id)
);

comment on table public.group_members is
  'Who is in a group thread. Added only by create_group_thread, add_group_members and accept_group_invite.';

create index group_members_user_idx on public.group_members (user_id);
create index group_members_added_by_idx on public.group_members (added_by);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.group_threads (id) on delete cascade,
  -- 122 random bits as 32 hex characters: unguessable, safe in a URL
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer not null default 20 check (max_uses between 1 and 50)
);

comment on table public.group_invites is
  'Join links for a group thread. Created with create_group_invite, read before joining with group_invite_preview, used with accept_group_invite.';

create index group_invites_thread_idx on public.group_invites (thread_id);
create index group_invites_created_by_idx on public.group_invites (created_by);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.group_threads (id) on delete cascade,
  -- The member who wrote it, joined or left; null for Wed
  sender_user_id uuid references auth.users (id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'wed', 'system')),
  kind text not null default 'text' check (kind in ('text', 'joined', 'left')),
  body text check (length(btrim(body)) between 1 and 4000),
  -- Wed: {vendorIds: [...]} for vendor cards under the answer
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  reply_to uuid,
  -- A member's message that tags @Wed: waiting, working (claimed by the
  -- brain), answered or failed. Null for every other message.
  wed_ask text check (wed_ask in ('waiting', 'working', 'answered', 'failed')),
  created_at timestamptz not null default now(),
  constraint group_messages_thread_id_id_key unique (thread_id, id),
  constraint group_messages_reply_to_fkey foreign key (thread_id, reply_to)
    references public.group_messages (thread_id, id) on delete set null (reply_to),
  constraint group_messages_text_has_body check (kind <> 'text' or body is not null),
  constraint group_messages_shape check (
    (sender_role = 'member' and kind = 'text' and sender_user_id is not null)
    or (sender_role = 'wed' and kind = 'text' and sender_user_id is null and wed_ask is null)
    or (sender_role = 'system' and kind in ('joined', 'left') and wed_ask is null)
  )
);

comment on table public.group_messages is
  'Messages in a group thread: members'' text, Wed''s answers (server only) and joined / left lines. Members read them; writes go through send_group_message.';
comment on column public.group_messages.wed_ask is
  'For a member''s message that tags @Wed: waiting, working, answered or failed. claim_wed_asks and post_wed_reply move it along.';

create index group_messages_thread_created_idx on public.group_messages (thread_id, created_at);
create index group_messages_sender_created_idx on public.group_messages (sender_user_id, created_at);
create index group_messages_reply_to_idx on public.group_messages (reply_to);
create index group_messages_wed_waiting_idx on public.group_messages (created_at) where wed_ask = 'waiting';

-- Helpers ------------------------------------------------------------------------------

-- Whether the caller is in a thread. Security definer so policies on
-- group_members can use it without recursing into themselves.
create function private.in_group(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.thread_id = p_thread_id and m.user_id = (select auth.uid())
  );
$$;

comment on function private.in_group is
  'Whether the caller is a member of a group thread. Used by RLS policies.';

-- In the thread and an owner or editor of its wedding.
create function private.can_manage_group(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.in_group(p_thread_id)
    and coalesce((select private.can_edit_wedding(t.wedding_id)
                  from public.group_threads t where t.id = p_thread_id), false);
$$;

comment on function private.can_manage_group is
  'Whether the caller can rename a thread, add or remove people and make links: in the thread and an owner or editor of the wedding.';

-- Put people in a thread with a "joined" line each. Callers have checked
-- who may be added; this keeps the size limits in one place.
create function private.join_group(p_thread_id uuid, p_user_ids uuid[], p_added_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_ids uuid[];
begin
  select coalesce(array_agg(distinct u), '{}') into new_ids
  from unnest(p_user_ids) as u
  where u is not null
    and not exists (select 1 from public.group_members m where m.thread_id = p_thread_id and m.user_id = u);
  if cardinality(new_ids) = 0 then
    return;
  end if;
  if (select count(*) from public.group_members where thread_id = p_thread_id) + cardinality(new_ids) > 50 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(new_ids) as u
    where (select count(*) from public.group_members m where m.user_id = u) >= 30
  ) then
    raise exception 'too_many_groups' using errcode = 'P0001';
  end if;

  insert into public.group_members (thread_id, user_id, added_by)
  select p_thread_id, u, p_added_by from unnest(new_ids) as u;
  insert into public.group_messages (thread_id, sender_user_id, sender_role, kind, created_at)
  select p_thread_id, u, 'system', 'joined', clock_timestamp() from unnest(new_ids) as u;
end;
$$;

-- When someone leaves or is removed: a "left" line, or delete the thread
-- when nobody is left. Account deletion cascades their messages away, so
-- no line is written for a person who no longer exists.
create function private.after_group_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.group_threads where id = old.thread_id) then
    return null;
  end if;
  if not exists (select 1 from public.group_members where thread_id = old.thread_id) then
    delete from public.group_threads where id = old.thread_id;
  elsif exists (select 1 from auth.users where id = old.user_id) then
    insert into public.group_messages (thread_id, sender_user_id, sender_role, kind, created_at)
    values (old.thread_id, old.user_id, 'system', 'left', clock_timestamp());
  end if;
  return null;
end;
$$;

create trigger after_group_member_removed after delete on public.group_members
  for each row execute function private.after_group_member_removed();

-- Access ------------------------------------------------------------------------------

alter table public.group_threads enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_messages enable row level security;

create policy "Members read their threads" on public.group_threads
  for select to authenticated
  using (private.in_group(id));

create policy "Members see who else is in the thread" on public.group_members
  for select to authenticated
  using (private.in_group(thread_id));

create policy "Managers see the links" on public.group_invites
  for select to authenticated
  using (private.can_manage_group(thread_id));
create policy "Managers cancel links" on public.group_invites
  for update to authenticated
  using (private.can_manage_group(thread_id))
  with check (private.can_manage_group(thread_id));

create policy "Members read the messages" on public.group_messages
  for select to authenticated
  using (private.in_group(thread_id));

revoke all on public.group_threads, public.group_members, public.group_invites, public.group_messages
  from anon, authenticated;

grant select on public.group_threads, public.group_members, public.group_messages to authenticated;
grant select on public.group_invites to authenticated;
grant update (revoked_at) on public.group_invites to authenticated;

alter publication supabase_realtime add table public.group_messages;

-- RPCs (security definer in private, invoker wrappers in public) -------------------------

-- Start a thread in a wedding (owners and editors), optionally with some of
-- the wedding's members in it from the start.
create function private.create_group_thread(p_wedding_id uuid, p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_id uuid;
begin
  if caller is null or not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if (select count(*) from public.group_threads where wedding_id = p_wedding_id) >= 10 then
    raise exception 'thread_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from public.group_members where user_id = caller) >= 30 then
    raise exception 'too_many_groups' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}')) as u
    where not exists (select 1 from public.wedding_members m where m.wedding_id = p_wedding_id and m.user_id = u)
  ) then
    raise exception 'not_in_wedding' using errcode = '22023';
  end if;

  insert into public.group_threads (wedding_id, name, created_by)
  values (p_wedding_id, btrim(p_name), caller)
  returning id into new_id;
  insert into public.group_members (thread_id, user_id) values (new_id, caller);
  perform private.join_group(new_id, p_member_ids, caller);
  return new_id;
end;
$$;

create function public.create_group_thread(p_wedding_id uuid, p_name text, p_member_ids uuid[] default '{}')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_group_thread(p_wedding_id, p_name, p_member_ids);
$$;

comment on function public.create_group_thread is
  'Start a group thread in a wedding (owners and editors), with the caller and any of the wedding''s members in it. Returns its id. Errors: not_allowed, invalid_name, thread_limit, not_in_wedding, group_full, too_many_groups.';

-- Add members of the wedding to a thread (managers).
create function private.add_group_members(p_thread_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wedding uuid := (select wedding_id from public.group_threads where id = p_thread_id);
begin
  if not private.can_manage_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_user_ids, '{}')) as u
    where not exists (select 1 from public.wedding_members m where m.wedding_id = wedding and m.user_id = u)
  ) then
    raise exception 'not_in_wedding' using errcode = '22023';
  end if;
  perform private.join_group(p_thread_id, p_user_ids, (select auth.uid()));
end;
$$;

create function public.add_group_members(p_thread_id uuid, p_user_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.add_group_members(p_thread_id, p_user_ids);
$$;

comment on function public.add_group_members is
  'Add members of the wedding to a thread (managers). Anyone else joins with a link. Errors: not_allowed, not_in_wedding, group_full, too_many_groups.';

create function private.rename_group_thread(p_thread_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.group_threads set name = btrim(p_name) where id = p_thread_id;
end;
$$;

create function public.rename_group_thread(p_thread_id uuid, p_name text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.rename_group_thread(p_thread_id, p_name);
$$;

comment on function public.rename_group_thread is
  'Rename a thread (managers). Errors: not_allowed, invalid_name.';

-- Leave (your own id) or, as a manager, remove someone.
create function private.remove_group_member(p_thread_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is distinct from (select auth.uid()) and not private.can_manage_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.group_members where thread_id = p_thread_id and user_id = p_user_id;
end;
$$;

create function public.remove_group_member(p_thread_id uuid, p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_group_member(p_thread_id, p_user_id);
$$;

comment on function public.remove_group_member is
  'Leave a thread (your own id) or, as a manager, remove someone. The last one out deletes the thread.';

-- A join link (managers); at most 10 open links per thread.
create function private.create_group_invite(p_thread_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text;
begin
  if not private.can_manage_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.group_invites
      where thread_id = p_thread_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;
  insert into public.group_invites (thread_id, created_by)
  values (p_thread_id, (select auth.uid()))
  returning token into new_token;
  return new_token;
end;
$$;

create function public.create_group_invite(p_thread_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.create_group_invite(p_thread_id);
$$;

comment on function public.create_group_invite is
  'Make a join link token for a thread (managers; 14 days, 20 uses). Errors: not_allowed, invite_limit.';

-- What someone sees before joining. Works logged out (the link opens from
-- WhatsApp, often on the web).
create function private.group_invite_preview(p_token text)
returns table (status text, thread_name text, wedding_title text, inviter_name text, member_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  inv public.group_invites;
begin
  select * into inv from public.group_invites i where i.token = lower(btrim(p_token));
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::integer;
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
    t.name,
    w.title,
    -- First name only
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    (select count(*)::integer from public.group_members m where m.thread_id = t.id)
  from public.group_threads t
  join public.weddings w on w.id = t.wedding_id
  left join public.profiles p on p.id = inv.created_by
  where t.id = inv.thread_id;
end;
$$;

create function public.group_invite_preview(p_token text)
returns table (status text, thread_name text, wedding_title text, inviter_name text, member_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.group_invite_preview(p_token);
$$;

comment on function public.group_invite_preview is
  'Before joining: the link''s status (valid, expired, used_up, revoked, not_found), the thread''s name, the wedding''s title, the inviter''s first name and how many are in it.';

-- Join a thread with a link. Joining again is harmless.
create function private.accept_group_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  inv public.group_invites;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into inv from public.group_invites i
  where i.token = lower(btrim(p_token))
  for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.group_members where thread_id = inv.thread_id and user_id = caller) then
    return inv.thread_id;
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  elsif inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  elsif inv.uses >= inv.max_uses then
    raise exception 'invite_used_up' using errcode = 'P0001';
  end if;

  perform private.join_group(inv.thread_id, array[caller], inv.created_by);
  update public.group_invites set uses = uses + 1 where id = inv.id;
  return inv.thread_id;
end;
$$;

create function public.accept_group_invite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_group_invite(p_token);
$$;

comment on function public.accept_group_invite is
  'Join a thread with a link token; returns the thread id. Errors: not_signed_in, invite_not_found, invite_revoked, invite_expired, invite_used_up, group_full, too_many_groups.';

-- Who is in a thread, for its members: names, whether they're in the
-- wedding (and as what) and whether they manage the thread.
create function private.group_members_list(p_thread_id uuid)
returns table (user_id uuid, name text, wedding_role text, can_manage boolean, is_me boolean, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    p.full_name,
    wm.role,
    coalesce(wm.role in ('owner', 'editor'), false),
    m.user_id = (select auth.uid()),
    m.joined_at
  from public.group_members m
  join public.group_threads t on t.id = m.thread_id
  left join public.profiles p on p.id = m.user_id
  left join public.wedding_members wm on wm.wedding_id = t.wedding_id and wm.user_id = m.user_id
  where m.thread_id = p_thread_id
    and private.in_group(p_thread_id)
  order by m.joined_at, m.user_id;
$$;

create function public.group_members_list(p_thread_id uuid)
returns table (user_id uuid, name text, wedding_role text, can_manage boolean, is_me boolean, joined_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.group_members_list(p_thread_id);
$$;

comment on function public.group_members_list is
  'Members of a thread with their names, their role in the wedding (null for friends outside it) and whether they manage the thread. Empty unless the caller is in it.';

-- Send a message. Tagging @Wed asks Wed.
create function private.send_group_message(p_thread_id uuid, p_body text, p_reply_to uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_id uuid;
begin
  if caller is null or not private.in_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  p_body := nullif(btrim(p_body), '');
  if p_body is null then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  if p_reply_to is not null and not exists (
    select 1 from public.group_messages m where m.id = p_reply_to and m.thread_id = p_thread_id
  ) then
    raise exception 'invalid_reply' using errcode = '22023';
  end if;
  if (select count(*) from public.group_messages
      where sender_user_id = caller and sender_role = 'member' and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'message_rate' using errcode = 'P0001';
  end if;

  -- clock_timestamp, not now(): read markers must fall after the message
  insert into public.group_messages (thread_id, sender_user_id, sender_role, body, reply_to, wed_ask, created_at)
  values (
    p_thread_id, caller, 'member', p_body, p_reply_to,
    -- "@Wed" as its own word, any case
    case when p_body ~* '(^|[^[:alnum:]_])@wed([^[:alnum:]_]|$)' then 'waiting' end,
    clock_timestamp()
  )
  returning id into new_id;
  update public.group_threads set last_message_at = clock_timestamp() where id = p_thread_id;
  update public.group_members set read_at = clock_timestamp()
  where thread_id = p_thread_id and user_id = caller;
  return new_id;
end;
$$;

create function public.send_group_message(p_thread_id uuid, p_body text, p_reply_to uuid default null)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.send_group_message(p_thread_id, p_body, p_reply_to);
$$;

comment on function public.send_group_message is
  'Send a text message to a thread you''re in, optionally replying to one in it. Tagging @Wed asks Wed (wed_ask = waiting). Errors: not_allowed, empty_message, invalid_reply, message_rate.';

create function private.mark_group_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set read_at = clock_timestamp()
  where thread_id = p_thread_id and user_id = (select auth.uid());
$$;

create function public.mark_group_read(p_thread_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_group_read(p_thread_id);
$$;

comment on function public.mark_group_read is
  'Mark a thread read up to now for the caller.';

-- The caller's threads, newest first, with the last message and how many
-- are unread.
create function private.my_group_threads()
returns table (
  id uuid,
  wedding_id uuid,
  name text,
  member_count integer,
  can_manage boolean,
  last_message_at timestamptz,
  last_kind text,
  last_body text,
  last_sender_role text,
  last_sender_name text,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.wedding_id,
    t.name,
    (select count(*)::integer from public.group_members gm where gm.thread_id = t.id),
    private.can_edit_wedding(t.wedding_id),
    t.last_message_at,
    last.kind,
    last.body,
    last.sender_role,
    last.sender_name,
    (select count(*)::integer from public.group_messages gm
     where gm.thread_id = t.id
       and gm.kind = 'text'
       and gm.sender_user_id is distinct from me.user_id
       and gm.created_at > coalesce(me.read_at, '-infinity'))
  from public.group_members me
  join public.group_threads t on t.id = me.thread_id
  left join lateral (
    select gm.kind, gm.body, gm.sender_role, p.full_name as sender_name
    from public.group_messages gm
    left join public.profiles p on p.id = gm.sender_user_id
    where gm.thread_id = t.id
    order by gm.created_at desc
    limit 1
  ) last on true
  where me.user_id = (select auth.uid())
  order by t.last_message_at desc;
$$;

create function public.my_group_threads()
returns table (
  id uuid,
  wedding_id uuid,
  name text,
  member_count integer,
  can_manage boolean,
  last_message_at timestamptz,
  last_kind text,
  last_body text,
  last_sender_role text,
  last_sender_name text,
  unread_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_group_threads();
$$;

comment on function public.my_group_threads is
  'The caller''s group threads, newest first: name, members, whether they manage it, the last message and how many text messages are unread.';

-- Wed (service role only) -------------------------------------------------------------

-- Hand the brain the questions waiting for Wed, each once, with the 20
-- messages before it and whether everyone in the thread is in the wedding.
-- Asks older than 10 minutes are given up as failed.
create function public.claim_wed_asks(p_limit integer default 20)
returns table (
  message_id uuid,
  thread_id uuid,
  wedding_id uuid,
  asker_name text,
  body text,
  all_in_wedding boolean,
  context jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.group_messages
  set wed_ask = 'failed'
  where wed_ask = 'waiting' and created_at < now() - interval '10 minutes';

  return query
  with claimed as (
    update public.group_messages gm
    set wed_ask = 'working'
    where gm.id in (
      select id from public.group_messages
      where wed_ask = 'waiting'
      order by created_at
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
      for update skip locked
    )
    returning gm.id, gm.thread_id, gm.sender_user_id, gm.body, gm.created_at
  )
  select
    c.id,
    c.thread_id,
    t.wedding_id,
    (select p.full_name from public.profiles p where p.id = c.sender_user_id),
    c.body,
    not exists (
      select 1 from public.group_members m
      where m.thread_id = c.thread_id
        and not exists (select 1 from public.wedding_members wm
                        where wm.wedding_id = t.wedding_id and wm.user_id = m.user_id)
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('from', x.sender, 'body', x.body, 'at', x.created_at) order by x.created_at)
      from (
        select
          case when gm.sender_role = 'wed' then 'Wed' else coalesce(p.full_name, 'Someone') end as sender,
          gm.body,
          gm.created_at
        from public.group_messages gm
        left join public.profiles p on p.id = gm.sender_user_id
        where gm.thread_id = c.thread_id and gm.kind = 'text' and gm.created_at < c.created_at
        order by gm.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  from claimed c
  join public.group_threads t on t.id = c.thread_id
  order by c.created_at;
end;
$$;

comment on function public.claim_wed_asks is
  'Service role (the Wed brain, #124): claim messages that tagged @Wed (each once), with the asker''s name, the 20 text messages before it and whether everyone in the thread is in the wedding. Asks older than 10 minutes become failed.';

-- Post Wed's answer to an ask, as a reply to it; a null body gives up.
create function public.post_wed_reply(p_message_id uuid, p_body text, p_data jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ask public.group_messages;
  new_id uuid;
begin
  select * into ask from public.group_messages where id = p_message_id for update;
  if not found or coalesce(ask.wed_ask, '') not in ('waiting', 'working') then
    raise exception 'not_waiting' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_body), '') is null then
    update public.group_messages set wed_ask = 'failed' where id = p_message_id;
    return null;
  end if;
  insert into public.group_messages (thread_id, sender_role, body, data, reply_to, created_at)
  values (ask.thread_id, 'wed', btrim(p_body), coalesce(p_data, '{}'::jsonb), ask.id, clock_timestamp())
  returning id into new_id;
  update public.group_messages set wed_ask = 'answered' where id = p_message_id;
  update public.group_threads set last_message_at = clock_timestamp() where id = ask.thread_id;
  return new_id;
end;
$$;

comment on function public.post_wed_reply is
  'Service role (the Wed brain, #124): post Wed''s answer as a reply to an ask (data may carry {vendorIds}), or give up with a null body. Errors: not_waiting.';

revoke all on function
  private.in_group, private.can_manage_group, private.join_group, private.after_group_member_removed,
  private.create_group_thread, private.add_group_members, private.rename_group_thread,
  private.remove_group_member, private.create_group_invite, private.group_invite_preview,
  private.accept_group_invite, private.group_members_list, private.send_group_message,
  private.mark_group_read, private.my_group_threads
  from public;
grant execute on function
  private.in_group, private.can_manage_group,
  private.create_group_thread, private.add_group_members, private.rename_group_thread,
  private.remove_group_member, private.create_group_invite, private.accept_group_invite,
  private.group_members_list, private.send_group_message, private.mark_group_read,
  private.my_group_threads
  to authenticated;
grant execute on function private.group_invite_preview to anon, authenticated;

revoke all on function
  public.create_group_thread, public.add_group_members, public.rename_group_thread,
  public.remove_group_member, public.create_group_invite, public.group_invite_preview,
  public.accept_group_invite, public.group_members_list, public.send_group_message,
  public.mark_group_read, public.my_group_threads, public.claim_wed_asks, public.post_wed_reply
  from public, anon, authenticated;
grant execute on function
  public.create_group_thread, public.add_group_members, public.rename_group_thread,
  public.remove_group_member, public.create_group_invite, public.accept_group_invite,
  public.group_members_list, public.send_group_message, public.mark_group_read,
  public.my_group_threads
  to authenticated;
grant execute on function public.group_invite_preview to anon, authenticated;
grant execute on function public.claim_wed_asks, public.post_wed_reply to service_role;
