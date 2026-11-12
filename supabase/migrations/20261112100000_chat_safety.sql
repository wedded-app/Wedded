-- Report and block in chat (App Store rule 1.2). Reels, stories and people
-- already have both; chat had neither. The reports table can't take a chat
-- column while the structure is frozen, so chat reports are their own table.

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null default auth.uid(),
  conversation_id uuid references public.conversations (id) on delete cascade,
  thread_id uuid references public.group_threads (id) on delete cascade,
  reason text not null check (reason in ('inappropriate', 'not_mine', 'privacy', 'spam', 'harassment', 'other')),
  note text check (length(btrim(note)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_reports_one_target check (num_nonnulls(conversation_id, thread_id) = 1)
);

comment on table public.chat_reports is
  'Reports of a vendor chat or a group chat (exactly one), for the founders'' queue. Written only by report_chat(); nobody reads them through the API.';

create index chat_reports_status_idx on public.chat_reports (status, created_at);
create index chat_reports_reporter_idx on public.chat_reports (reporter_id);
create index chat_reports_conversation_idx on public.chat_reports (conversation_id);
create index chat_reports_thread_idx on public.chat_reports (thread_id);
create index chat_reports_handled_by_idx on public.chat_reports (handled_by);

create table public.chat_blocks (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  blocked_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, blocked_by)
);

comment on table public.chat_blocks is
  'Vendor chats someone blocked: nobody can send in one until they unblock it. Written only by block_chat(); each person reads their own.';

create index chat_blocks_blocked_by_idx on public.chat_blocks (blocked_by);

alter table public.chat_reports enable row level security;
alter table public.chat_blocks enable row level security;

create policy "People see the chats they blocked" on public.chat_blocks
  for select to authenticated
  using ((select auth.uid()) = blocked_by);

revoke all on public.chat_reports, public.chat_blocks from anon, authenticated;
grant select on public.chat_blocks to authenticated;

-- Reporting -----------------------------------------------------------------------------

create function private.report_chat(p_conversation_id uuid, p_thread_id uuid, p_reason text, p_note text)
returns void
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
  -- Only a chat you're in (the one-target check refuses both or neither)
  if not (coalesce(private.can_see_conversation(p_conversation_id), false)
      or coalesce(private.in_group(p_thread_id), false)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- The same 20 a day as reels, counted together
  if (select count(*) from public.chat_reports
      where reporter_id = caller and created_at > now() - interval '1 day')
    + (select count(*) from public.reports
      where reporter_id = caller and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_limit' using errcode = 'P0001';
  end if;
  insert into public.chat_reports (reporter_id, conversation_id, thread_id, reason, note)
  values (caller, p_conversation_id, p_thread_id, p_reason, nullif(btrim(p_note), ''));
end;
$$;

create function public.report_chat(
  p_conversation_id uuid default null,
  p_thread_id uuid default null,
  p_reason text default 'other',
  p_note text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.report_chat(p_conversation_id, p_thread_id, p_reason, p_note);
$$;

comment on function public.report_chat is
  'Report a vendor chat or a group chat you are in, for the founders to review. Errors: not_signed_in, not_allowed, report_limit (20 a day with reel reports).';

-- Blocking ------------------------------------------------------------------------------

create function private.block_chat(p_conversation_id uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not private.can_see_conversation(p_conversation_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_block then
    insert into public.chat_blocks (conversation_id, blocked_by)
    values (p_conversation_id, caller)
    on conflict do nothing;
  else
    delete from public.chat_blocks
    where conversation_id = p_conversation_id and blocked_by = caller;
  end if;
end;
$$;

create function public.block_chat(p_conversation_id uuid, p_block boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.block_chat(p_conversation_id, p_block);
$$;

comment on function public.block_chat is
  'Block (true) or unblock (false) a vendor chat you are in. While blocked, neither side can send. Errors: not_allowed.';

-- A blocked chat takes nothing a person sends, whichever function writes it
-- (a message, a quote, a deposit request, an inquiry's card). The app's own
-- lines (a deposit was paid) still land.
-- shortcut: a new inquiry to a blocked chat fails as a plain server error; give send-inquiry its own answer if families hit it
create function private.refuse_blocked_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_role <> 'system'
    and exists (select 1 from public.chat_blocks b where b.conversation_id = new.conversation_id) then
    raise exception 'chat_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger refuse_blocked_chat before insert on public.messages
  for each row execute function private.refuse_blocked_chat();

revoke all on function private.report_chat, private.block_chat, private.refuse_blocked_chat from public;
grant execute on function private.report_chat, private.block_chat to authenticated;
revoke all on function public.report_chat, public.block_chat from public;
grant execute on function public.report_chat, public.block_chat to authenticated;
