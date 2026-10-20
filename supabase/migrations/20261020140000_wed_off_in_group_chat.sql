-- Until Wed's brain exists (#124), "@Wed" in a family chat showed "Wed is
-- looking…" forever: nothing calls claim_wed_asks(), so the ask never even
-- timed out (#352). Wed now has a switch, app_config.wed_group_chat, off until
-- the brain is deployed. While it's off, tagging Wed gets an immediate reply
-- from Wed saying it can't help here yet, and the ask is answered, so nothing
-- waits. The brain's PR sets the switch to true.

insert into public.app_config (key, value) values ('wed_group_chat', 'false')
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION private.send_group_message(p_thread_id uuid, p_body text, p_reply_to uuid, p_photo jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  photo jsonb;
  new_id uuid;
  asks_wed boolean := p_body ~* '(^|[^[:alnum:]_])@wed([^[:alnum:]_]|$)';
begin
  if caller is null or not private.in_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  p_body := nullif(btrim(p_body), '');
  if p_photo is not null then
    if jsonb_typeof(p_photo -> 'path') is distinct from 'string'
      or split_part(p_photo ->> 'path', '/', 1) <> p_thread_id::text then
      raise exception 'invalid_photo' using errcode = '22023';
    end if;
    -- Only what the screen needs, never whatever else was sent along
    photo := jsonb_strip_nulls(jsonb_build_object(
      'path', p_photo -> 'path',
      'width', case when jsonb_typeof(p_photo -> 'width') = 'number' then p_photo -> 'width' end,
      'height', case when jsonb_typeof(p_photo -> 'height') = 'number' then p_photo -> 'height' end
    ));
  elsif p_body is null then
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
  insert into public.group_messages (thread_id, sender_user_id, sender_role, kind, body, data, reply_to, wed_ask, created_at)
  values (
    p_thread_id, caller, 'member',
    case when photo is null then 'text' else 'photo' end,
    p_body, coalesce(photo, '{}'::jsonb), p_reply_to,
    -- "@Wed" as its own word, any case
    case when asks_wed then 'waiting' end,
    clock_timestamp()
  )
  returning id into new_id;
  update public.group_threads set last_message_at = clock_timestamp() where id = p_thread_id;
  update public.group_members set read_at = clock_timestamp()
  where thread_id = p_thread_id and user_id = caller;

  -- Until the brain is on (app_config.wed_group_chat), Wed says so at once
  -- instead of leaving the ask waiting
  if asks_wed and not coalesce(
    (select c.value = 'true'::jsonb from public.app_config c where c.key = 'wed_group_chat'), false
  ) then
    perform public.post_wed_reply(new_id,
      'I can''t help in family chats just yet. Ask me from the Wed tab and I''ll get it done there.');
  end if;
  return new_id;
end;
$function$;
