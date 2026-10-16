-- Stories (Kirat, 2026-10-16): photos and short clips that last a day, as on
-- Instagram, TikTok and Snapchat. Anyone signed in posts one, as themselves
-- or as a business they belong to; they show on the Reels tab as rings.
--
-- The same rules as reels (App Store rule 1.2): a consent tick, a daily
-- limit, blocking hides them both ways, and every story can be reported.
-- Files go in the public `reels` bucket under <user id>/, like reels.
-- After 24 hours a story leaves every feed; the app deletes its poster's
-- expired rows and files the next time they open Reels.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Posted as a vendor account (its members), or null for a person's own
  vendor_id uuid references public.vendors (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  media_path text not null check (media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  -- A clip's still for its ring; a photo is its own
  thumb_path text check (thumb_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  duration_s numeric(5, 2) check (duration_s > 0 and duration_s <= 90),
  width integer check (width between 1 and 8192),
  height integer check (height between 1 and 8192),
  caption text check (length(btrim(caption)) between 1 and 200),
  -- live, or hidden by the founders after a report
  status text not null default 'live' check (status in ('live', 'hidden')),
  created_at timestamptz not null default now(),
  constraint stories_clip_length check ((kind = 'video') = (duration_s is not null))
);

comment on table public.stories is
  'Photos and clips that show for 24 hours on the Reels tab: a person''s (author_id) or a vendor''s (vendor_id). Written only by create_story(); the founders hide reported ones.';

create index stories_feed_idx on public.stories (status, created_at desc);
create index stories_author_idx on public.stories (author_id, created_at desc);
create index stories_vendor_idx on public.stories (vendor_id);

alter table public.stories enable row level security;

create policy "Today's stories are readable, except from people you've blocked" on public.stories
  for select to anon, authenticated
  using (
    (status = 'live' and created_at > now() - interval '1 day'
      and not private.blocked_between((select auth.uid()), author_id))
    or author_id = (select auth.uid())
  );
create policy "People delete their own stories" on public.stories
  for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.stories from anon, authenticated;
grant select on public.stories to anon, authenticated;
grant delete on public.stories to authenticated;

-- Reports can name a story -----------------------------------------------------------------------

alter table public.reel_reports
  add column story_id uuid references public.stories (id) on delete cascade,
  drop constraint reel_reports_one_target,
  add constraint reel_reports_one_target
    check (num_nonnulls(reel_id, comment_id, reported_user_id, story_id) = 1);

create index reel_reports_story_idx on public.reel_reports (story_id);

drop function public.report_reel_content(uuid, uuid, uuid, text, text);
drop function private.report_reel_content(uuid, uuid, uuid, text, text);

-- Report a reel, a comment, a person or a story (exactly one). 20 a day per person.
create function private.report_reel_content(
  p_reel_id uuid, p_comment_id uuid, p_user_id uuid, p_reason text, p_note text, p_story_id uuid)
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
  if (select count(*) from public.reel_reports
      where reporter_id = caller and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_limit' using errcode = 'P0001';
  end if;
  insert into public.reel_reports
    (reporter_id, reel_id, comment_id, reported_user_id, story_id, reason, note)
  values
    (caller, p_reel_id, p_comment_id, p_user_id, p_story_id, p_reason, nullif(btrim(p_note), ''));
end;
$$;

create function public.report_reel_content(
  p_reel_id uuid default null, p_comment_id uuid default null, p_user_id uuid default null,
  p_reason text default 'other', p_note text default null, p_story_id uuid default null)
returns void language sql security invoker set search_path = '' as $$
  select private.report_reel_content(p_reel_id, p_comment_id, p_user_id, p_reason, p_note, p_story_id);
$$;

-- Writing ----------------------------------------------------------------------------------------

-- Post a story after uploading its file (and a clip's still) to <your id>/
-- in the reels bucket. As a vendor's member, p_vendor_id posts it as that
-- business. p_consent: everyone shown is happy to be in it. 30 a day.
create function private.create_story(
  p_kind text, p_media_path text, p_thumb_path text, p_duration_s numeric, p_width integer,
  p_height integer, p_caption text, p_vendor_id uuid, p_consent boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  folder text;
  new_id uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  folder := caller::text || '/';
  if left(p_media_path, length(folder)) <> folder
    or (p_thumb_path is not null and left(p_thumb_path, length(folder)) <> folder) then
    raise exception 'not_your_file' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'reels' and name = p_media_path) then
    raise exception 'media_not_uploaded' using errcode = 'P0002';
  end if;
  if p_vendor_id is not null and not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.stories
      where author_id = caller and created_at > now() - interval '1 day') >= 30 then
    raise exception 'story_limit' using errcode = 'P0001';
  end if;

  insert into public.stories
    (author_id, vendor_id, kind, media_path, thumb_path, duration_s, width, height, caption)
  values
    (caller, p_vendor_id, p_kind, p_media_path, p_thumb_path,
     case when p_kind = 'video' then p_duration_s end, p_width, p_height, nullif(btrim(p_caption), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.create_story(
  p_kind text, p_media_path text, p_thumb_path text, p_duration_s numeric, p_width integer,
  p_height integer, p_caption text, p_vendor_id uuid, p_consent boolean)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_story(p_kind, p_media_path, p_thumb_path, p_duration_s, p_width,
    p_height, p_caption, p_vendor_id, p_consent);
$$;

comment on function public.create_story is
  'Post a story after uploading its file to <your id>/ in the reels bucket. Errors: not_signed_in, consent_required, not_your_file, media_not_uploaded, not_allowed, story_limit.';

-- Reading ----------------------------------------------------------------------------------------

-- Every story from the last 24 hours, oldest first, with who posted it and
-- whether you follow them, leaving out people you've blocked or who blocked
-- you. The app groups them by poster.
-- shortcut: no paging (500 at most); page by poster when there are more.
create function private.stories_feed()
returns table (
  id uuid, kind text, media_path text, thumb_path text, duration_s numeric, width integer,
  height integer, caption text, created_at timestamptz, author_id uuid, author_name text,
  vendor_id uuid, vendor_slug text, vendor_name text, following boolean, is_mine boolean,
  is_sample boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.kind, s.media_path, s.thumb_path, s.duration_s, s.width, s.height, s.caption,
    s.created_at, s.author_id, private.short_name(p.full_name), s.vendor_id, v.slug, v.name,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and (case when s.vendor_id is not null then f.vendor_id = s.vendor_id else f.user_id = s.author_id end)
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
$$;

create function public.stories_feed()
returns table (
  id uuid, kind text, media_path text, thumb_path text, duration_s numeric, width integer,
  height integer, caption text, created_at timestamptz, author_id uuid, author_name text,
  vendor_id uuid, vendor_slug text, vendor_name text, following boolean, is_mine boolean,
  is_sample boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.stories_feed();
$$;

comment on function public.stories_feed is
  'Every story from the last 24 hours, oldest first, with the poster, whether you follow them and whether it is yours.';

revoke all on function
  private.report_reel_content, private.create_story, private.stories_feed,
  public.report_reel_content, public.create_story, public.stories_feed
  from public;
grant execute on function private.stories_feed, public.stories_feed to anon, authenticated;
grant execute on function
  private.report_reel_content, private.create_story,
  public.report_reel_content, public.create_story
  to authenticated;
