-- Accounts and safety, to the database design: the phones that get push
-- alerts are devices, reports live in one table, and a follow has its own id.
--
-- devices   Was push_tokens: an id, the push_token, and when the phone was
--           last seen (was updated_at).
-- reports   Was reel_reports. It keeps one foreign key per kind of thing
--           reported (a reel, a comment, a story, a person; exactly one), so
--           a removed reel takes its reports with it, where the design's
--           target_type and target_id would leave them pointing at nothing.
--           Reports of vendors, messages and reviews add their own key with
--           those features. Who handled a report, and when, are new.
-- follows   An id each; user_id and vendor_id are followee_user_id and
--           followee_vendor_id (exactly one of the two, as before).

-- Devices ---------------------------------------------------------------------------------

alter table public.push_tokens rename to devices;
alter table public.devices rename column token to push_token;
alter table public.devices rename column updated_at to last_seen_at;
alter table public.devices drop constraint push_tokens_pkey;
alter table public.devices add column id uuid not null default gen_random_uuid();
alter table public.devices
  add constraint devices_pkey primary key (id),
  add constraint devices_push_token_key unique (push_token);
alter table public.devices rename constraint push_tokens_platform_check to devices_platform_check;
alter table public.devices rename constraint push_tokens_token_check to devices_push_token_check;
alter table public.devices rename constraint push_tokens_user_id_fkey to devices_user_id_fkey;
alter index public.push_tokens_user_idx rename to devices_user_idx;
alter policy "People see their own push tokens" on public.devices rename to "People see their own devices";

comment on table public.devices is
  'Phones that get push alerts: an Expo push token each, newest first per person (at most 10).';

-- Registering a phone keeps it fresh; at most 10 per person
CREATE OR REPLACE FUNCTION private.register_push_token(p_token text, p_platform text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  insert into public.devices (push_token, user_id, platform, created_at, last_seen_at)
  values (p_token, caller, p_platform, clock_timestamp(), clock_timestamp())
  on conflict (push_token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = clock_timestamp();

  delete from public.devices
  where user_id = caller
    and push_token not in (
      select d.push_token from public.devices d
      where d.user_id = caller
      order by d.last_seen_at desc
      limit 10
    );
end;
$function$;

CREATE OR REPLACE FUNCTION private.unregister_push_token(p_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from public.devices where push_token = p_token and user_id = (select auth.uid());
$function$;

-- Chat pushes go to the recipient's devices
CREATE OR REPLACE FUNCTION public.claim_push_messages()
 RETURNS TABLE(message_id uuid, conversation_id uuid, recipient_side text, tokens text[], title text, kind text, body text, data jsonb, event_names text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      select array_agg(t.push_token order by t.last_seen_at desc)
      from public.devices t
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
$function$;

CREATE OR REPLACE FUNCTION public.claim_group_push()
 RETURNS TABLE(message_id uuid, thread_id uuid, tokens text[], thread_name text, sender_name text, kind text, body text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      select array_agg(pt.push_token order by pt.last_seen_at desc)
      from public.group_members m
      join public.devices pt on pt.user_id = m.user_id
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
$function$;

-- Reports ---------------------------------------------------------------------------------

alter table public.reel_reports rename to reports;
alter table public.reports rename column reported_user_id to user_id;
alter table public.reports
  add column handled_by uuid references auth.users (id) on delete set null,
  add column handled_at timestamptz;

do $$
declare
  r record;
begin
  for r in select conname from pg_constraint
    where conrelid = 'public.reports'::regclass and conname like 'reel_reports%'
  loop
    execute format('alter table public.reports rename constraint %I to %I', r.conname,
      replace(replace(r.conname, 'reel_reports_reported_user_id', 'reports_user_id'), 'reel_reports', 'reports'));
  end loop;
  for r in select i.relname from pg_class i join pg_index x on x.indexrelid = i.oid
    where x.indrelid = 'public.reports'::regclass and i.relname like 'reel_reports%'
  loop
    execute format('alter index public.%I rename to %I', r.relname, replace(r.relname, 'reel_reports', 'reports'));
  end loop;
end;
$$;

create index reports_handled_by_idx on public.reports (handled_by);

comment on table public.reports is
  'Reports of a reel, a comment, a story or a person (exactly one), for the founders'' queue. Open until handled: actioned or dismissed, by whom and when.';

CREATE OR REPLACE FUNCTION private.report_reel_content(p_reel_id uuid, p_comment_id uuid, p_user_id uuid, p_reason text, p_note text, p_story_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if (select count(*) from public.reports
      where reporter_id = caller and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_limit' using errcode = 'P0001';
  end if;
  insert into public.reports
    (reporter_id, reel_id, comment_id, user_id, story_id, reason, note)
  values
    (caller, p_reel_id, p_comment_id, p_user_id, p_story_id, p_reason, nullif(btrim(p_note), ''));
end;
$function$;

-- A reported story stays until the report is handled
CREATE OR REPLACE FUNCTION public.expired_stories(p_limit integer DEFAULT 500)
 RETURNS TABLE(id uuid, media_path text, thumb_path text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select s.id, s.media_path, s.thumb_path
  from public.stories s
  where s.created_at < now() - interval '1 day'
    and not exists (
      select 1 from public.reports r where r.story_id = s.id and r.status = 'open'
    )
  order by s.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$function$;

-- Follows -----------------------------------------------------------------------------------

alter table public.follows add column id uuid not null default gen_random_uuid();
alter table public.follows add constraint follows_pkey primary key (id);
alter table public.follows rename column user_id to followee_user_id;
alter table public.follows rename column vendor_id to followee_vendor_id;
alter table public.follows rename constraint follows_user_id_fkey to follows_followee_user_id_fkey;
alter table public.follows rename constraint follows_vendor_id_fkey to follows_followee_vendor_id_fkey;
alter index public.follows_user_unique rename to follows_followee_user_unique;
alter index public.follows_vendor_unique rename to follows_followee_vendor_unique;
alter index public.follows_user_idx rename to follows_followee_user_idx;
alter index public.follows_vendor_idx rename to follows_followee_vendor_idx;

comment on table public.follows is 'Following a person or a vendor; exactly one of the two.';

CREATE OR REPLACE FUNCTION private.reel_person(p_user_id uuid)
 RETURNS TABLE(name text, reel_count bigint, follower_count bigint, following_count bigint, following boolean, blocked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    private.short_name(p.full_name),
    (select count(*) from public.reels r where r.author_id = p_user_id and r.vendor_id is null and r.status = 'live'),
    (select count(*) from public.follows f where f.followee_user_id = p_user_id),
    (select count(*) from public.follows f where f.follower_id = p_user_id),
    exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_user_id = p_user_id),
    exists (select 1 from public.user_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p_user_id)
  from public.profiles p
  where p.id = p_user_id
    and not exists (select 1 from public.user_blocks b where b.blocker_id = p_user_id and b.blocked_id = (select auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION private.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text)
 RETURNS TABLE(id uuid, video_path text, thumb_path text, duration_s numeric, width integer, height integer, caption text, event_slug text, created_at timestamp with time zone, author_id uuid, author_name text, vendor_id uuid, vendor_slug text, vendor_name text, tags jsonb, like_count bigint, comment_count bigint, liked boolean, following boolean, is_mine boolean, source text, platform text, source_url text, credit_name text, is_sample boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.id, r.video_path, r.thumb_path, r.duration_s, r.width, r.height, r.caption, r.event_slug,
    r.created_at, r.author_id,
    private.short_name(p.full_name),
    r.vendor_id, v.slug, v.name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'vendor_id', tv.id, 'slug', tv.slug, 'name', tv.name, 'status', t.status)
        order by t.created_at)
      from public.reel_vendor_tags t
      join public.vendors tv on tv.id = t.vendor_id and tv.status = 'published'
      where t.reel_id = r.id and t.status <> 'declined'
        and t.vendor_id is distinct from r.vendor_id
    ), '[]'::jsonb),
    (select count(*) from public.reel_likes l where l.reel_id = r.id),
    (select count(*) from public.reel_comments c
     where c.reel_id = r.id and not c.hidden
       and not private.blocked_between((select auth.uid()), c.user_id)),
    exists (select 1 from public.reel_likes l where l.reel_id = r.id and l.user_id = (select auth.uid())),
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and (case when r.vendor_id is not null then f.followee_vendor_id = r.vendor_id else f.followee_user_id = r.author_id end)
    ),
    r.author_id = (select auth.uid()),
    r.source, r.platform, r.source_url, r.credit_name,
    coalesce(v.is_sample, false) or coalesce(p.is_sample, false)
  from public.reels r
  left join public.profiles p on p.id = r.author_id
  left join public.vendors v on v.id = r.vendor_id
  where r.status = 'live'
    and r.created_at < coalesce(p_before, 'infinity'::timestamptz)
    and not private.blocked_between((select auth.uid()), r.author_id)
    and (r.vendor_id is null or v.status = 'published')
    and (nullif(p_event_slug, '') is null or r.event_slug = p_event_slug)
    and case p_mode
      when 'following' then exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid())
          and (f.followee_user_id = r.author_id or (r.vendor_id is not null and f.followee_vendor_id = r.vendor_id)))
      when 'person' then r.author_id = p_user_id and r.vendor_id is null
      when 'vendor' then r.vendor_id = p_vendor_id or exists (
        select 1 from public.reel_vendor_tags t
        where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status = 'approved')
      else true
    end
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$function$;

CREATE OR REPLACE FUNCTION private.stories_feed()
 RETURNS TABLE(id uuid, kind text, media_path text, thumb_path text, duration_s numeric, width integer, height integer, caption text, created_at timestamp with time zone, author_id uuid, author_name text, vendor_id uuid, vendor_slug text, vendor_name text, following boolean, is_mine boolean, is_sample boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    s.id, s.kind, s.media_path, s.thumb_path, s.duration_s, s.width, s.height, s.caption,
    s.created_at, s.author_id, private.short_name(p.full_name), s.vendor_id, v.slug, v.name,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and (case when s.vendor_id is not null then f.followee_vendor_id = s.vendor_id else f.followee_user_id = s.author_id end)
    ),
    s.author_id = (select auth.uid()),
    coalesce(v.is_sample, false) or coalesce(p.is_sample, false)
  from public.stories s
  left join public.profiles p on p.id = s.author_id
  left join public.vendors v on v.id = s.vendor_id
  where s.status = 'live'
    and s.created_at > now() - interval '1 day'
    and not private.blocked_between((select auth.uid()), s.author_id)
    and (s.vendor_id is null or v.status = 'published')
  order by s.created_at
  limit 500;
$function$;
