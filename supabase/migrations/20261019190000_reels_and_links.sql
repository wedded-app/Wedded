-- Reels and linked accounts, to the database design (reel_comments,
-- reel_vendor_tags, reel_views_daily, linked_accounts, linked_account_tokens):
-- a hidden comment records when and by whom, a tag decision records who
-- decided, a reel's daily count is its views, and the linked-account columns
-- take the design's names. Nothing the app shows changes.

-- Comments: hidden becomes when and by whom (only the reel's poster hides)
alter table public.reel_comments
  add column hidden_at timestamptz,
  add column hidden_by uuid references auth.users (id) on delete set null;
update public.reel_comments c
set hidden_at = now(), hidden_by = r.author_id
from public.reels r
where r.id = c.reel_id and c.hidden;

drop policy "Comments on readable reels are readable" on public.reel_comments;
alter table public.reel_comments drop column hidden;
create policy "Comments on readable reels are readable" on public.reel_comments
  for select to anon, authenticated
  using (
    hidden_at is null
    and not private.blocked_between((select auth.uid()), user_id)
    and exists (select 1 from public.reels r where r.id = reel_id)
  );
create index reel_comments_hidden_by_idx on public.reel_comments (hidden_by) where hidden_by is not null;

-- Tags: who approved or declined (the time was already kept)
alter table public.reel_vendor_tags
  add column decided_by uuid references auth.users (id) on delete set null;
create index reel_vendor_tags_decided_by_idx on public.reel_vendor_tags (decided_by) where decided_by is not null;

-- A reel's count per day is its views
alter table public.reel_views_daily rename column count to views;
alter table public.reel_views_daily rename constraint reel_views_daily_count_check to reel_views_daily_views_check;

-- Linked accounts: the design's names. Nothing writes the tokens yet; the
-- Instagram and TikTok import (#136, #137) saves them encrypted.
alter table public.linked_accounts rename column linked_at to connected_at;
alter table public.linked_account_tokens rename column account_id to linked_account_id;
alter table public.linked_account_tokens rename column access_token to access_token_enc;
alter table public.linked_account_tokens rename column refresh_token to refresh_token_enc;
alter table public.linked_account_tokens
  rename constraint linked_account_tokens_account_id_fkey to linked_account_tokens_linked_account_id_fkey;
comment on column public.linked_account_tokens.access_token_enc is
  'Encrypted by the server before it is saved; only the server reads it.';

-- A business's reels count views and the comments still showing
CREATE OR REPLACE FUNCTION private.business_reels(p_vendor_id uuid)
 RETURNS TABLE(id uuid, thumb_path text, caption text, created_at timestamp with time zone, own boolean, views integer, likes integer, comments integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.thumb_path,
    r.caption,
    r.created_at,
    r.vendor_id is not distinct from p_vendor_id,
    coalesce((select sum(rv.views) from public.reel_views_daily rv where rv.reel_id = r.id), 0)::integer,
    (select count(*) from public.reel_likes l where l.reel_id = r.id)::integer,
    (select count(*) from public.reel_comments c where c.reel_id = r.id and c.hidden_at is null)::integer
  from public.reels r
  where r.status = 'live'
    and (r.vendor_id = p_vendor_id or exists (
      select 1 from public.reel_vendor_tags t
      where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status <> 'declined'
    ))
  order by r.created_at desc
  limit 50;
end;
$function$
;

-- and so do its stats
CREATE OR REPLACE FUNCTION private.business_stats(p_vendor_id uuid, p_from date, p_to date)
 RETURNS TABLE(views integer, calls integer, texts integer, whatsapps integer, directions integer, instagram integer, website integer, shares integer, contacts integer, saves integer, inquiries integer, reel_views integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return query
  with activity as (
    select a.kind, sum(a.count)::integer as n
    from public.vendor_activity_daily a
    where a.vendor_id = p_vendor_id and a.day between p_from and p_to
    group by a.kind
  ),
  bounds as (
    select
      (p_from::timestamp at time zone 'America/Los_Angeles') as starts,
      ((p_to + 1)::timestamp at time zone 'America/Los_Angeles') as ends
  ),
  -- The vendor's own reels and the ones they're tagged in (not declined)
  vendor_reels as (
    select r.id from public.reels r where r.vendor_id = p_vendor_id
    union
    select t.reel_id from public.reel_vendor_tags t
    where t.vendor_id = p_vendor_id and t.status <> 'declined'
  ),
  counts as (
    select
      coalesce((select n from activity where kind = 'view'), 0) as views,
      coalesce((select n from activity where kind = 'call'), 0) as calls,
      coalesce((select n from activity where kind = 'text'), 0) as texts,
      coalesce((select n from activity where kind = 'whatsapp'), 0) as whatsapps,
      coalesce((select n from activity where kind = 'directions'), 0) as directions,
      coalesce((select n from activity where kind = 'instagram'), 0) as instagram,
      coalesce((select n from activity where kind = 'website'), 0) as website,
      coalesce((select n from activity where kind = 'share'), 0) as shares
  )
  select
    c.views, c.calls, c.texts, c.whatsapps, c.directions, c.instagram, c.website, c.shares,
    c.calls + c.texts + c.whatsapps + c.directions + c.instagram + c.website,
    (select count(*)::integer from public.saved_vendors s, bounds b
     where s.vendor_id = p_vendor_id and s.created_at >= b.starts and s.created_at < b.ends),
    (select count(*)::integer from public.inquiries i, bounds b
     where i.vendor_id = p_vendor_id and i.created_at >= b.starts and i.created_at < b.ends),
    (select coalesce(sum(rv.views), 0)::integer from public.reel_views_daily rv
     where rv.reel_id in (select id from vendor_reels) and rv.day between p_from and p_to)
  from counts c;
end;
$function$
;

-- A view adds to the day's views
CREATE OR REPLACE FUNCTION private.track_reel_view(p_reel_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.reels where id = p_reel_id and status = 'live') then
    return;
  end if;
  insert into public.reel_views_daily as r (reel_id, day, views)
  values (p_reel_id, (now() at time zone 'America/Los_Angeles')::date, 1)
  on conflict (reel_id, day) do update
    set views = r.views + 1
    where r.views < 50000;
end;
$function$
;

-- A tag decision records who decided
CREATE OR REPLACE FUNCTION private.decide_reel_tag(p_reel_id uuid, p_vendor_id uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.reel_vendor_tags
  set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = (select auth.uid())
  where reel_id = p_reel_id and vendor_id = p_vendor_id;
  if not found then
    raise exception 'tag_not_found' using errcode = 'P0002';
  end if;
end;
$function$
;

-- and a business's own tag is approved by whoever posted it
CREATE OR REPLACE FUNCTION private.tag_new_reel(p_reel_id uuid, p_vendor_id uuid, p_tags uuid[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.reel_vendor_tags (reel_id, vendor_id, status, decided_at, decided_by)
  select p_reel_id, p_vendor_id, 'approved', now(), (select auth.uid()) where p_vendor_id is not null;
  insert into public.reel_vendor_tags (reel_id, vendor_id)
  select p_reel_id, t.id from unnest(p_tags) as t (id);
$function$
;

-- Hiding a comment records when and by whom
CREATE OR REPLACE FUNCTION private.hide_reel_comment(p_comment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.reel_comments c
  set hidden_at = now(), hidden_by = (select auth.uid())
  from public.reels r
  where c.id = p_comment_id and r.id = c.reel_id and r.author_id = (select auth.uid());
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$function$
;

-- Hidden comments stay out of the list
CREATE OR REPLACE FUNCTION private.reel_comments_list(p_reel_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, name text, body text, created_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.user_id, private.short_name(p.full_name), c.body, c.created_at,
    c.user_id = (select auth.uid())
  from public.reel_comments c
  join public.reels r on r.id = c.reel_id and r.status = 'live'
  left join public.profiles p on p.id = c.user_id
  where c.reel_id = p_reel_id and c.hidden_at is null
    and not private.blocked_between((select auth.uid()), c.user_id)
    and not private.blocked_between((select auth.uid()), r.author_id)
  order by c.created_at
  limit 500;
$function$
;

-- and out of the feed's counts
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
     where c.reel_id = r.id and c.hidden_at is null
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
$function$
;
