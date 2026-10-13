-- Push alerts for new messages (C5f, #160): a new chat message (or a new
-- request, which arrives as a booking message) buzzes the other side's phones.
--
-- push_tokens               One row per phone: its Expo push token and whose it
--                           is. Written only by register_push_token() and
--                           unregister_push_token().
-- messages.pushed_at        Stamped once a message's alert is sent, so each
--                           message buzzes at most once.
-- claim_push_messages()     Service role only: messages from the last 10
--                           minutes not pushed yet, stamped, with the tokens to
--                           send to and what to say.
-- A trigger on new messages calls the push-chat Edge Function straight away
-- (through pg_net, with the URL and key from Vault, like notify-chat), and
-- pg_cron calls it every minute as a safety net.

create table public.push_tokens (
  token text primary key
    check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.push_tokens is
  'Expo push tokens, one per phone, for message alerts. People see their own; written by register_push_token() and unregister_push_token().';

create index push_tokens_user_idx on public.push_tokens (user_id, updated_at desc);

alter table public.push_tokens enable row level security;

create policy "People see their own push tokens" on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

-- Save this phone's token for the signed-in person. A phone that changes hands
-- (sign out, someone else signs in) moves to the new person. Up to 10 phones
-- each; the oldest goes.
create function private.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid_platform' using errcode = '22023';
  end if;

  -- clock_timestamp, so "newest" is exact even within one transaction
  insert into public.push_tokens (token, user_id, platform, created_at, updated_at)
  values (p_token, caller, p_platform, clock_timestamp(), clock_timestamp())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = clock_timestamp();

  delete from public.push_tokens
  where user_id = caller
    and token not in (
      select t.token from public.push_tokens t
      where t.user_id = caller
      order by t.updated_at desc
      limit 10
    );
end;
$$;

create function public.register_push_token(p_token text, p_platform text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.register_push_token(p_token, p_platform);
$$;

comment on function public.register_push_token is
  'Save this phone''s Expo push token for the signed-in person (ios, android or web). Errors: not_allowed, invalid_token, invalid_platform.';

-- Forget this phone (on sign out, or when alerts are turned off).
create function private.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.unregister_push_token(p_token);
$$;

comment on function public.unregister_push_token is
  'Forget one of your phones'' push tokens (sign out, or alerts turned off).';

revoke all on function
  private.register_push_token, public.register_push_token,
  private.unregister_push_token, public.unregister_push_token
from public;
grant execute on function
  private.register_push_token, public.register_push_token,
  private.unregister_push_token, public.unregister_push_token
to authenticated;

-- Claiming messages to push ---------------------------------------------------------------

alter table public.messages add column pushed_at timestamptz;
-- Messages already sent never buzz
update public.messages set pushed_at = created_at;

comment on column public.messages.pushed_at is
  'When this message''s push alert was sent (or found nobody to send to). Null: not yet.';

create index messages_unpushed_idx on public.messages (created_at) where pushed_at is null;

-- Messages from the last 10 minutes not pushed yet, stamped, each with the
-- other side's phones (never the sender's own) and what the alert says.
-- Older ones are stamped without sending: a late buzz is worse than none.
create function public.claim_push_messages()
returns table (
  message_id uuid,
  conversation_id uuid,
  recipient_side text,
  tokens text[],
  title text,
  kind text,
  body text,
  data jsonb,
  event_names text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set pushed_at = now()
  where pushed_at is null and created_at < now() - interval '10 minutes';

  return query
  with claimed as (
    update public.messages m
    set pushed_at = now()
    where m.id in (
      select id from public.messages
      where pushed_at is null
      order by created_at
      limit 200
      for update skip locked
    )
    returning m.id, m.conversation_id, m.sender_user_id, m.sender_role, m.kind, m.body, m.data
  )
  select
    c.id,
    c.conversation_id,
    case when c.sender_role = 'vendor' then 'family' else 'vendor' end,
    coalesce((
      select array_agg(t.token order by t.updated_at desc)
      from public.push_tokens t
      where t.user_id is distinct from c.sender_user_id
        and (
          (c.sender_role = 'vendor' and t.user_id = conv.family_user_id)
          or (c.sender_role <> 'vendor' and t.user_id in (
            select vm.user_id from public.vendor_members vm where vm.vendor_id = conv.vendor_id))
        )
    ), '{}'),
    -- To the vendor: the family's short name; to the family: the business
    case when c.sender_role = 'vendor' then v.name else coalesce(conv.family_name, 'A family') end,
    c.kind,
    c.body,
    -- Never the phone number itself on a lock screen
    case when c.kind = 'phone' then '{}'::jsonb else c.data end,
    case when c.kind = 'booking' then (
      select coalesce(array_agg(coalesce(e.name ->> 'en', s.slug) order by s.n), '{}')
      from jsonb_array_elements_text(coalesce(c.data -> 'eventSlugs', '[]'::jsonb))
        with ordinality as s (slug, n)
      left join public.events e on e.slug = s.slug
    ) else '{}' end
  from claimed c
  join public.conversations conv on conv.id = c.conversation_id
  join public.vendors v on v.id = conv.vendor_id;
end;
$$;

comment on function public.claim_push_messages is
  'Service role only: new messages not pushed yet (last 10 minutes), stamped, with the other side''s push tokens and the alert''s title and content.';

revoke all on function public.claim_push_messages from public, anon, authenticated;
grant execute on function public.claim_push_messages to service_role;

-- Calling push-chat ---------------------------------------------------------------------

-- Ask push-chat to send now. Does nothing when Vault isn't set up (local
-- databases, tests), and never stops a message from being saved.
create function private.poke_push_chat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  service_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
begin
  if url is null or service_key is null then
    return;
  end if;
  perform net.http_post(
    url := url || '/functions/v1/push-chat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
exception when others then
  -- An alert is never worth losing a message over
  null;
end;
$$;

revoke all on function private.poke_push_chat from public;

create function private.push_new_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.poke_push_chat();
  return null;
end;
$$;

-- Once per statement, so a burst of messages makes one call
create trigger messages_push
  after insert on public.messages
  for each statement
  execute function private.push_new_messages();

-- The safety net: every minute, only when something is waiting
select cron.schedule(
  'push-chat',
  '* * * * *',
  $job$
  select private.poke_push_chat()
  where exists (select 1 from public.messages where pushed_at is null);
  $job$
);
