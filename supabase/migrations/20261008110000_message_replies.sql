-- Swipe to reply in chat (C5d, #158): a message can quote an earlier one in
-- the same conversation, shown above the reply on both phones.
--
-- * messages.reply_to points at the quoted message. A foreign key on
--   (conversation_id, reply_to) keeps it inside the same conversation, and
--   deleting the quoted message just drops the quote (set null), never the reply.
-- * send_message takes an optional p_reply_to. Its signature changes, so the
--   old one is dropped and recreated with every C2 rule (#171) unchanged.

alter table public.messages add constraint messages_conversation_id_id_key unique (conversation_id, id);

alter table public.messages add column reply_to uuid;
alter table public.messages add constraint messages_reply_to_fkey
  foreign key (conversation_id, reply_to) references public.messages (conversation_id, id)
  on delete set null (reply_to);

create index messages_reply_to_idx on public.messages (reply_to);

comment on column public.messages.reply_to is
  'The earlier message this one quotes (swipe to reply), always in the same conversation; null when it isn''t a reply or the quoted message is gone.';

-- send_message, now with p_reply_to -------------------------------------------------------------

drop function public.send_message(uuid, text, text, jsonb);
drop function private.send_message(uuid, text, text, jsonb);

create function private.send_message(
  p_conversation_id uuid,
  p_kind text,
  p_body text,
  p_data jsonb,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  convo public.conversations;
  role text;
  family_last timestamptz;
  new_id uuid;
begin
  select * into convo from public.conversations where id = p_conversation_id;
  if convo.id is null or caller is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if convo.family_user_id = caller then
    role := 'family';
  elsif private.is_vendor_member(convo.vendor_id) then
    role := 'vendor';
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  p_body := nullif(btrim(p_body), '');
  p_data := coalesce(p_data, '{}'::jsonb);
  if p_kind = 'text' then
    if p_body is null then
      raise exception 'empty_message' using errcode = '22023';
    end if;
  elsif p_kind = 'photo' then
    if jsonb_typeof(p_data -> 'path') is distinct from 'string'
      or split_part(p_data ->> 'path', '/', 1) <> p_conversation_id::text then
      raise exception 'invalid_photo' using errcode = '22023';
    end if;
  elsif p_kind = 'quote' and role = 'vendor' then
    if jsonb_typeof(p_data -> 'amount') is distinct from 'number' or (p_data ->> 'amount')::numeric <= 0 then
      raise exception 'invalid_quote' using errcode = '22023';
    end if;
  elsif p_kind = 'menu' and role = 'vendor' then
    if not exists (
      select 1 from public.vendor_menus m
      where m.id::text = p_data ->> 'menuId' and m.vendor_id = convo.vendor_id
    ) then
      raise exception 'invalid_menu' using errcode = '22023';
    end if;
  elsif p_kind = 'phone' and role = 'family' then
    -- The number on their own profile, never one typed into the message
    p_data := jsonb_build_object('phone', (select phone from public.profiles where id = caller));
    p_body := null;
    if p_data ->> 'phone' is null then
      raise exception 'no_phone' using errcode = 'P0002';
    end if;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;

  -- A reply quotes a message from this same conversation
  if p_reply_to is not null and not exists (
    select 1 from public.messages m
    where m.id = p_reply_to and m.conversation_id = p_conversation_id
  ) then
    raise exception 'invalid_reply' using errcode = '22023';
  end if;

  if role = 'vendor' then
    select max(created_at) into family_last
    from public.messages
    where conversation_id = p_conversation_id and sender_role = 'family';
    if family_last is null then
      raise exception 'family_first' using errcode = '42501';
    end if;
    if (select count(*) from public.messages
        where conversation_id = p_conversation_id and sender_role = 'vendor'
          and created_at > family_last + interval '24 hours') >= 2
      and clock_timestamp() > family_last + interval '24 hours' then
      raise exception 'wait_for_reply' using errcode = 'P0001';
    end if;
  end if;

  if (select count(*) from public.messages
      where sender_user_id = caller and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'message_rate' using errcode = 'P0001';
  end if;

  -- clock_timestamp, not now(): read markers must fall after the message
  -- even when several things happen in one transaction
  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, reply_to, created_at)
  values (p_conversation_id, caller, role, p_kind, p_body, p_data, p_reply_to, clock_timestamp())
  returning id into new_id;

  if role = 'family' then
    update public.conversations
    set last_message_at = clock_timestamp(), family_read_at = clock_timestamp()
    where id = p_conversation_id;
  else
    update public.conversations
    set last_message_at = clock_timestamp(), vendor_read_at = clock_timestamp()
    where id = p_conversation_id;
  end if;
  return new_id;
end;
$$;

create function public.send_message(
  p_conversation_id uuid,
  p_kind text default 'text',
  p_body text default null,
  p_data jsonb default '{}',
  p_reply_to uuid default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.send_message(p_conversation_id, p_kind, p_body, p_data, p_reply_to);
$$;

comment on function public.send_message is
  'Send a message in a conversation you''re part of, optionally replying to an earlier message in it (p_reply_to). Families: text, photo, phone (shares the number on their profile). Vendors: text, photo, quote, menu, only after the family has written, and at most 2 follow-ups once 24 hours pass without a family reply. Errors: not_allowed, empty_message, invalid_photo, invalid_quote, invalid_menu, invalid_kind, no_phone, invalid_reply, family_first, wait_for_reply, message_rate.';

revoke all on function private.send_message, public.send_message from public;
grant execute on function private.send_message, public.send_message to authenticated;
