-- A reel you reported leaves your own feed at once (#352). The founders still
-- see it in their queue and decide; everyone else sees it until they do.
-- Only the reporter's filter is new; the rest of the feed is unchanged.

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
    -- A reel you reported is gone for you at once
    and not exists (
      select 1 from public.reports rp
      where rp.reel_id = r.id and rp.reporter_id = (select auth.uid()))
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
