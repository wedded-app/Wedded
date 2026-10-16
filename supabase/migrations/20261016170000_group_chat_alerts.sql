-- Group chat photos, push alerts and emails (follows A3, #126).
--
-- Photos      group_messages.kind 'photo' with {path, width, height}, an
--             optional caption in body. Files go in the private chat-media
--             bucket under <thread id>/, readable and uploaded only by the
--             thread's members (can_use_chat_object now knows threads too).
--             send_group_message takes p_photo.
-- Push        group_messages.pushed_at, like messages.pushed_at: each text,
--             photo or Wed answer buzzes everyone else in the thread once.
--             claim_group_push() (service role) hands them to push-chat; the
--             same trigger and pg_cron job call it.
-- Email       group_members.notified_at: when messages sit unread past the
--             quiet minutes, a member gets one email per thread, and no
--             more until they've read it. claim_group_notifications()
--             (service role) hands them to notify-chat, which already runs
--             every 2 minutes. Phone-only accounts have no email to send to.

-- Photos ------------------------------------------------------------------------------

alter table public.group_messages drop constraint group_messages_kind_check;
alter table public.group_messages add constraint group_messages_kind_check
  check (kind in ('text', 'photo', 'joined', 'left'));
alter table public.group_messages drop constraint group_messages_shape;
alter table public.group_messages add constraint group_messages_shape check (
  (sender_role = 'member' and kind in ('text', 'photo') and sender_user_id is not null)
  or (sender_role = 'wed' and kind = 'text' and sender_user_id is null and wed_ask is null)
  or (sender_role = 'system' and kind in ('joined', 'left') and wed_ask is null)
);
alter table public.group_messages add constraint group_messages_photo_has_path
  check (kind <> 'photo' or jsonb_typeof(data -> 'path') = 'string');

-- <conversation id>/<file> for the family and the vendor, <thread id>/<file>
-- for a group thread's members. Both are random uuids, so they never clash.
create or replace function private.can_use_chat_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.can_see_conversation(split_part(p_name, '/', 1)::uuid)
        or private.in_group(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$;

drop function public.send_group_message(uuid, text, uuid);
drop function private.send_group_message(uuid, text, uuid);

-- Send a text, or a photo (p_photo {path, width, height}, already uploaded to
-- the thread's folder) with an optional caption. Tagging @Wed asks Wed.
create function private.send_group_message(p_thread_id uuid, p_body text, p_reply_to uuid, p_photo jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  photo jsonb;
  new_id uuid;
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

create function public.send_group_message(
  p_thread_id uuid,
  p_body text default null,
  p_reply_to uuid default null,
  p_photo jsonb default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.send_group_message(p_thread_id, p_body, p_reply_to, p_photo);
$$;

comment on function public.send_group_message is
  'Send a text, or a photo (p_photo {path, width, height} in the thread''s chat-media folder) with an optional caption, to a thread you''re in, optionally replying to one in it. Tagging @Wed asks Wed. Errors: not_allowed, empty_message, invalid_photo, invalid_reply, message_rate.';

revoke all on function private.send_group_message, public.send_group_message from public, anon, authenticated;
grant execute on function private.send_group_message, public.send_group_message to authenticated;

-- Photos count as unread too.
create or replace function private.my_group_threads()
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
       and gm.kind in ('text', 'photo')
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

-- Push alerts -------------------------------------------------------------------------

alter table public.group_messages add column pushed_at timestamptz;
-- Messages already sent never buzz
update public.group_messages set pushed_at = created_at;

comment on column public.group_messages.pushed_at is
  'When this message''s push alerts were sent (or it needed none). Null: not yet.';

create index group_messages_unpushed_idx on public.group_messages (created_at) where pushed_at is null;

-- New texts, photos and Wed answers not pushed yet, stamped, each with the
-- phones of everyone else in the thread. Joined / left lines are stamped
-- without buzzing; messages older than 10 minutes too (a late buzz is worse
-- than none).
create function public.claim_group_push()
returns table (
  message_id uuid,
  thread_id uuid,
  tokens text[],
  thread_name text,
  sender_name text,
  kind text,
  body text
)
language sql
security definer
set search_path = ''
as $$
  update public.group_messages
  set pushed_at = now()
  where pushed_at is null and (created_at < now() - interval '10 minutes' or kind not in ('text', 'photo'));

  with claimed as (
    update public.group_messages gm
    set pushed_at = now()
    where gm.id in (
      select m.id from public.group_messages m
      where m.pushed_at is null
      order by m.created_at
      limit 200
      for update skip locked
    )
    returning gm.id, gm.thread_id, gm.sender_user_id, gm.sender_role, gm.kind, gm.body, gm.created_at
  )
  select
    c.id,
    c.thread_id,
    coalesce((
      select array_agg(pt.token order by pt.updated_at desc)
      from public.group_members m
      join public.push_tokens pt on pt.user_id = m.user_id
      where m.thread_id = c.thread_id and m.user_id is distinct from c.sender_user_id
    ), '{}'),
    t.name,
    case
      when c.sender_role = 'wed' then 'Wed'
      else coalesce(private.short_name(p.full_name), 'Someone')
    end,
    c.kind,
    c.body
  from claimed c
  join public.group_threads t on t.id = c.thread_id
  left join public.profiles p on p.id = c.sender_user_id
  order by c.created_at;
$$;

comment on function public.claim_group_push is
  'Service role only (push-chat): new group texts, photos and Wed answers not pushed yet (last 10 minutes), stamped, with everyone else''s push tokens, the thread''s name and who sent it.';

revoke all on function public.claim_group_push from public, anon, authenticated;
grant execute on function public.claim_group_push to service_role;

-- Once per statement, like messages: a burst of messages makes one call
create trigger group_messages_push
  after insert on public.group_messages
  for each statement
  execute function private.push_new_messages();

-- The safety net now also looks at group messages (same job name: replaces it)
select cron.schedule(
  'push-chat',
  '* * * * *',
  $job$
  select private.poke_push_chat()
  where exists (select 1 from public.messages where pushed_at is null)
     or exists (select 1 from public.group_messages where pushed_at is null);
  $job$
);

-- Emails ------------------------------------------------------------------------------

alter table public.group_members add column notified_at timestamptz;

comment on column public.group_members.notified_at is
  'When this member was last emailed about unread messages in the thread. No new email until read_at passes it.';

-- Members with texts, photos or Wed answers from others unread for
-- p_quiet_minutes, who haven't been emailed since they last read the thread,
-- stamped, with their sign-in email and what's waiting. Threads quiet for 14
-- days are left alone.
create function public.claim_group_notifications(p_quiet_minutes integer default 3)
returns table (
  thread_id uuid,
  user_id uuid,
  recipient text,
  thread_name text,
  wedding_title text,
  unread_count integer,
  last_sender_name text,
  last_kind text,
  last_body text,
  notified_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select m.thread_id, m.user_id, m.read_at, u.email::text as email
    from public.group_members m
    join public.group_threads t on t.id = m.thread_id
    join auth.users u on u.id = m.user_id
    where u.email is not null
      and t.last_message_at > now() - interval '14 days'
      and coalesce(m.notified_at, '-infinity') <= coalesce(m.read_at, '-infinity')
      and exists (
        select 1 from public.group_messages gm
        where gm.thread_id = m.thread_id
          and gm.kind in ('text', 'photo')
          and gm.sender_user_id is distinct from m.user_id
          and gm.created_at > coalesce(m.read_at, '-infinity')
          and gm.created_at < now() - make_interval(mins => greatest(p_quiet_minutes, 0))
      )
    for update of m skip locked
  ),
  stamped as (
    update public.group_members m
    set notified_at = now()
    from due
    where m.thread_id = due.thread_id and m.user_id = due.user_id
    returning m.thread_id, m.user_id, due.read_at, due.email, m.notified_at
  )
  select
    s.thread_id,
    s.user_id,
    s.email,
    t.name,
    w.title,
    (select count(*)::integer from public.group_messages gm
     where gm.thread_id = s.thread_id and gm.kind in ('text', 'photo')
       and gm.sender_user_id is distinct from s.user_id
       and gm.created_at > coalesce(s.read_at, '-infinity')),
    last.sender_name,
    last.kind,
    last.body,
    s.notified_at
  from stamped s
  join public.group_threads t on t.id = s.thread_id
  join public.weddings w on w.id = t.wedding_id
  left join lateral (
    select
      case when gm.sender_role = 'wed' then 'Wed' else coalesce(private.short_name(p.full_name), 'Someone') end
        as sender_name,
      gm.kind,
      gm.body
    from public.group_messages gm
    left join public.profiles p on p.id = gm.sender_user_id
    where gm.thread_id = s.thread_id and gm.kind in ('text', 'photo')
      and gm.sender_user_id is distinct from s.user_id
    order by gm.created_at desc
    limit 1
  ) last on true;
$$;

comment on function public.claim_group_notifications is
  'Service role only (notify-chat): members with group messages unread for p_quiet_minutes and not emailed since they last read the thread, stamped, with their email and the latest message.';

revoke all on function public.claim_group_notifications from public, anon, authenticated;
grant execute on function public.claim_group_notifications to service_role;
