-- No-spam rules for chat (C2, #142). Families must never feel chased:
--
-- * A vendor only ever replies. A conversation is already only started by a
--   family (start_conversation, or their inquiry), but tapping Message
--   creates it before they type anything; now a vendor can't write until the
--   family has (a message, or the inquiry's booking card).
-- * Follow-ups are limited: a vendor writes freely for 24 hours after the
--   family's latest message, then at most 2 more until the family writes again.
-- * A family's phone number stays out of chat until they tap "Share my number":
--   a new `phone` message, filled in here from their own profile so nobody can
--   pass off another number. (The inquiry form is unchanged: there the family
--   types the number for the vendor to call, on purpose.)

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'photo', 'quote', 'menu', 'booking', 'phone'));

comment on column public.messages.data is
  'photo: {path, width, height}; quote: {amount, unit, eventSlug, date, guests, note, validUntil}; menu: {menuId}; booking: the inquiry''s details; phone: {phone}, from the family''s profile.';

create or replace function private.send_message(
  p_conversation_id uuid,
  p_kind text,
  p_body text,
  p_data jsonb
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
  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, created_at)
  values (p_conversation_id, caller, role, p_kind, p_body, p_data, clock_timestamp())
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

comment on function public.send_message is
  'Send a message in a conversation you''re part of. Families: text, photo, phone (shares the number on their profile). Vendors: text, photo, quote, menu, only after the family has written, and at most 2 follow-ups once 24 hours pass without a family reply. Errors: not_allowed, empty_message, invalid_photo, invalid_quote, invalid_menu, invalid_kind, no_phone, family_first, wait_for_reply, message_rate.';
