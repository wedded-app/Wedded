-- The family chat list says "You: …" for your own last message, like the
-- vendor inbox (follows A2, #125): my_group_threads() gains last_sender_is_me.
-- Its columns change, so both functions are dropped and made again.

drop function public.my_group_threads();
drop function private.my_group_threads();

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
  last_sender_is_me boolean,
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
    coalesce(last.sender_user_id = me.user_id, false),
    (select count(*)::integer from public.group_messages gm
     where gm.thread_id = t.id
       and gm.kind in ('text', 'photo')
       and gm.sender_user_id is distinct from me.user_id
       and gm.created_at > coalesce(me.read_at, '-infinity'))
  from public.group_members me
  join public.group_threads t on t.id = me.thread_id
  left join lateral (
    select gm.kind, gm.body, gm.sender_role, gm.sender_user_id, p.full_name as sender_name
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
  last_sender_is_me boolean,
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
  'The caller''s group threads, newest first: name, members, whether they manage it, the last message (and whether it was theirs) and how many texts and photos are unread.';

revoke all on function private.my_group_threads, public.my_group_threads from public, anon, authenticated;
grant execute on function private.my_group_threads, public.my_group_threads to authenticated;
