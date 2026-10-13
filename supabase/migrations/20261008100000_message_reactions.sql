-- Reactions on chat messages (C5c, #157): hold a message, pick one of six
-- emoji. One reaction per person per message, like iMessage: picking another
-- replaces it, picking the same one again takes it back. Only the two sides
-- of a conversation see them, and they arrive live.

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  -- The message's conversation, kept here so access and live updates can use it directly
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Stored as names; the app draws them: ❤️ 👍 😂 😮 😢 🙏
  reaction text not null check (reaction in ('heart', 'thumbs_up', 'laugh', 'wow', 'sad', 'pray')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

comment on table public.message_reactions is
  'One emoji reaction per person per chat message. Written only through react_to_message().';

create index message_reactions_conversation_idx on public.message_reactions (conversation_id);
create index message_reactions_user_idx on public.message_reactions (user_id);

alter table public.message_reactions enable row level security;

create policy "Both sides see a conversation's reactions" on public.message_reactions
  for select to authenticated
  using (private.can_see_conversation(conversation_id));

revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;

-- Live: deletes must carry conversation_id for the app's filter
alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;

-- React to a message in a conversation you're part of; null takes your reaction back
create function private.react_to_message(p_message_id uuid, p_reaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  convo uuid;
begin
  select conversation_id into convo from public.messages where id = p_message_id;
  if caller is null or convo is null or not private.can_see_conversation(convo) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_reaction is null then
    delete from public.message_reactions where message_id = p_message_id and user_id = caller;
    return;
  end if;
  if p_reaction not in ('heart', 'thumbs_up', 'laugh', 'wow', 'sad', 'pray') then
    raise exception 'invalid_reaction' using errcode = '22023';
  end if;

  insert into public.message_reactions (message_id, conversation_id, user_id, reaction)
  values (p_message_id, convo, caller, p_reaction)
  on conflict (message_id, user_id) do update
    set reaction = excluded.reaction, created_at = now();
end;
$$;

create function public.react_to_message(p_message_id uuid, p_reaction text default null)
returns void language sql security invoker set search_path = '' as $$
  select private.react_to_message(p_message_id, p_reaction);
$$;

comment on function public.react_to_message is
  'React to a chat message (heart, thumbs_up, laugh, wow, sad, pray), replacing your reaction; null removes it. Errors: not_allowed, invalid_reaction.';

revoke all on function private.react_to_message, public.react_to_message from public;
grant execute on function private.react_to_message, public.react_to_message to authenticated;
