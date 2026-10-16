-- Sample labels (#239, legal checklist "no fake reviews or unsupported
-- claims"): the demo's sample vendors, reels and requests are marked so the
-- app can tag them "Sample". Vendors already have is_sample; sample people
-- (the reel and request sample scripts' @example.com accounts) get it on
-- their profile. Only the service role sets it.

alter table public.profiles add column is_sample boolean not null default false;

comment on column public.profiles.is_sample is
  'A demo account made by a sample script (reels:samples, requests:samples). The app tags its reels and requests "Sample". Service role only.';

update public.profiles p
set is_sample = true
from auth.users u
where u.id = p.id
  and (u.email like 'sample-reels-%@example.com' or u.email like 'sample-requests-%@example.com');

-- reels_feed, families_looking and search_vendors gain a last column, is_sample

drop function public.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text);
drop function private.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text);
drop function public.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer);
drop function private.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer);
drop function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date);

create or replace function private.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text)
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
        and (case when r.vendor_id is not null then f.vendor_id = r.vendor_id else f.user_id = r.author_id end)
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
          and (f.user_id = r.author_id or (r.vendor_id is not null and f.vendor_id = r.vendor_id)))
      when 'person' then r.author_id = p_user_id and r.vendor_id is null
      when 'vendor' then r.vendor_id = p_vendor_id or exists (
        select 1 from public.reel_vendor_tags t
        where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status = 'approved')
      else true
    end
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$function$;
revoke all on function private.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text) from public;
grant execute on function private.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text) to anon, authenticated;

create or replace function public.reels_feed(p_mode text DEFAULT 'for_you'::text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 10, p_user_id uuid DEFAULT NULL::uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_event_slug text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, video_path text, thumb_path text, duration_s numeric, width integer, height integer, caption text, event_slug text, created_at timestamp with time zone, author_id uuid, author_name text, vendor_id uuid, vendor_slug text, vendor_name text, tags jsonb, like_count bigint, comment_count bigint, liked boolean, following boolean, is_mine boolean, source text, platform text, source_url text, credit_name text, is_sample boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.reels_feed(p_mode, p_before, p_limit, p_user_id, p_vendor_id, p_event_slug);
$function$;
comment on function public.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text) is
  'A page of reels: for_you, following, person (p_user_id) or vendor (p_vendor_id), newest first before p_before, optionally only one event (p_event_slug). source is upload, import or link; a link has source_url and no video_path.';
revoke all on function public.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text) from public;
grant execute on function public.reels_feed(p_mode text, p_before timestamp with time zone, p_limit integer, p_user_id uuid, p_vendor_id uuid, p_event_slug text) to anon, authenticated, service_role;

create or replace function private.families_looking(p_vendor_id uuid, p_category_slug text DEFAULT NULL::text, p_max_miles integer DEFAULT 50, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, family_name text, city text, category_slug text, category_name jsonb, event_slug text, event_name jsonb, event_date date, guest_band text, budget_min_cents integer, budget_max_cents integer, note text, miles numeric, proposal_count integer, proposals_full boolean, already_proposed boolean, date_status text, created_at timestamp with time zone, is_sample boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_pro(p_vendor_id) then
    raise exception 'pro_only' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    coalesce(private.short_name(p.full_name), 'A family'),
    c.name,
    r.category_slug,
    cat.name,
    r.event_slug,
    e.name,
    r.event_date,
    r.guest_band,
    r.budget_min_cents,
    r.budget_max_cents,
    r.note,
    f.miles,
    r.proposal_count,
    r.proposal_count >= 10,
    exists (select 1 from public.request_proposals rp where rp.request_id = r.id and rp.vendor_id = p_vendor_id),
    case when r.event_date is null then 'unknown' else public.vendor_date_status(p_vendor_id, r.event_date) end,
    r.created_at,
    coalesce(p.is_sample, false)
  from private.fitting_requests(p_vendor_id, p_max_miles) f
  join public.wedding_requests r on r.id = f.request_id
  join public.cities c on c.slug = r.city_slug
  join public.categories cat on cat.slug = r.category_slug
  left join public.events e on e.slug = r.event_slug
  left join public.profiles p on p.id = r.created_by
  where (p_category_slug is null or r.category_slug = p_category_slug)
    and (p_from is null or r.event_date >= p_from)
    and (p_to is null or r.event_date <= p_to)
    and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$function$;
revoke all on function private.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer) from public;
grant execute on function private.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer) to authenticated;

create or replace function public.families_looking(p_vendor_id uuid, p_category_slug text DEFAULT NULL::text, p_max_miles integer DEFAULT 50, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, family_name text, city text, category_slug text, category_name jsonb, event_slug text, event_name jsonb, event_date date, guest_band text, budget_min_cents integer, budget_max_cents integer, note text, miles numeric, proposal_count integer, proposals_full boolean, already_proposed boolean, date_status text, created_at timestamp with time zone, is_sample boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.families_looking(p_vendor_id, p_category_slug, p_max_miles, p_from, p_to,
    p_before, p_limit);
$function$;
comment on function public.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer) is
  'Wedded Pro: open requests that fit this vendor (their vendor types, within p_max_miles or their own travel area), newest first, with the short family name and town only. Errors: not_allowed, pro_only.';
revoke all on function public.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer) from public;
grant execute on function public.families_looking(p_vendor_id uuid, p_category_slug text, p_max_miles integer, p_from date, p_to date, p_before timestamp with time zone, p_limit integer) to anon, authenticated, service_role;

create or replace function public.search_vendors(lat double precision DEFAULT NULL::double precision, lng double precision DEFAULT NULL::double precision, max_miles integer DEFAULT 25, category_slug text DEFAULT NULL::text, event_slug text DEFAULT NULL::text, query text DEFAULT NULL::text, include_travelers boolean DEFAULT false, result_limit integer DEFAULT 50, result_offset integer DEFAULT 0, min_guests integer DEFAULT NULL::integer, max_price integer DEFAULT NULL::integer, language text DEFAULT NULL::text, sort text DEFAULT 'distance'::text, available_on date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, slug text, name text, city text, primary_category_slug text, primary_category_name jsonb, price_display text, price_from integer, price_to integer, price_unit text, founding_number smallint, distance_miles double precision, within_search_radius boolean, latitude double precision, longitude double precision, cover_path text, is_sample boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with origin as (
    select case
      when search_vendors.lat is null or search_vendors.lng is null then null
      else extensions.st_setsrid(
        extensions.st_makepoint(search_vendors.lng, search_vendors.lat), 4326
      )::extensions.geography
    end as point
  ),
  needle as (
    select
      t.text,
      -- For ILIKE: the text with \, % and _ escaped, so they match literally
      '%' || replace(replace(replace(t.text, '\', '\'), '%', '\%'), '_', '\_') || '%' as pattern,
      private.search_words(t.text) as words
    from (select nullif(btrim(search_vendors.query), '') as text) t
  ),
  candidates as (
    select
      v.*,
      extensions.st_distance(v.location, o.point) / 1609.344 as miles,
      n.text is not null and (
        v.name ilike n.pattern
        or v.tagline ilike n.pattern
        or exists (
          select 1
          from public.vendor_categories vc
          join public.categories c on c.slug = vc.category_slug
          where vc.vendor_id = v.id
            and (c.name ->> 'en' ilike n.pattern
              or exists (select 1 from unnest(c.aliases) as a (alias) where a.alias ilike n.pattern))
        )
      ) as exact_match,
      n.text is not null and private.words_match_loosely(
        n.words,
        private.search_words(v.name) || coalesce((
          select array_agg(word)
          from public.vendor_categories vc
          join public.categories c on c.slug = vc.category_slug
          cross join lateral unnest(
            private.search_words(c.name ->> 'en')
              || private.search_words(array_to_string(c.aliases, ' '))
          ) as word
          where vc.vendor_id = v.id
        ), '{}')
      ) as loose_match
    from public.vendors v
    cross join origin o
    cross join needle n
    where v.status = 'published'
      and (search_vendors.category_slug is null or exists (
        select 1 from public.vendor_categories vc
        where vc.vendor_id = v.id and vc.category_slug = search_vendors.category_slug
      ))
      and (search_vendors.event_slug is null or exists (
        select 1 from public.vendor_events ve
        where ve.vendor_id = v.id and ve.event_slug = search_vendors.event_slug
      ))
      -- Venues that seat at least this many (vendors without a capacity, like
      -- a DJ, aren't filtered out)
      and (search_vendors.min_guests is null
        or jsonb_typeof(v.details -> 'seated_capacity') is distinct from 'number'
        or (v.details ->> 'seated_capacity')::numeric >= search_vendors.min_guests)
      -- A shown starting price at or under this (vendors who don't show a
      -- price stay in: "Contact for price")
      and (search_vendors.max_price is null
        or v.price_display not in ('starting_at', 'range')
        or v.price_from is null
        or v.price_from <= search_vendors.max_price)
      and (search_vendors.language is null or search_vendors.language = any (v.languages))
      -- Not booked all day on the family's date (held or partly booked stays in)
      and (search_vendors.available_on is null or not exists (
        select 1 from public.vendor_unavailable_days u
        where u.vendor_id = v.id and u.day = search_vendors.available_on
          and u.part = 'all_day' and u.status = 'booked'
      ))
      and (o.point is null
        or search_vendors.max_miles is null
        or extensions.st_dwithin(
          v.location, o.point, greatest(search_vendors.max_miles, v.service_radius_miles) * 1609.344
        )
        or (search_vendors.include_travelers and v.will_travel))
  ),
  matches as (
    select c.*
    from candidates c
    cross join needle n
    where n.text is null
      or c.exact_match
      -- Close spellings only when nothing matched exactly
      or (c.loose_match and not exists (select 1 from candidates e where e.exact_match))
  )
  select
    m.id,
    m.slug,
    m.name,
    m.city,
    pc.category_slug,
    c.name,
    m.price_display,
    m.price_from,
    m.price_to,
    m.price_unit,
    m.founding_number,
    m.miles,
    case when m.miles is null or search_vendors.max_miles is null then null
      else m.miles <= search_vendors.max_miles end,
    extensions.st_y(m.location::extensions.geometry),
    extensions.st_x(m.location::extensions.geometry),
    cover.storage_path,
    m.is_sample
  from matches m
  left join lateral (
    select vc.category_slug
    from public.vendor_categories vc
    where vc.vendor_id = m.id
    order by vc.position
    limit 1
  ) pc on true
  left join public.categories c on c.slug = pc.category_slug
  left join lateral (
    select vm.storage_path
    from public.vendor_media vm
    where vm.vendor_id = m.id
    order by vm.is_cover desc, vm.sort_order, vm.created_at
    limit 1
  ) cover on true
  order by
    case when search_vendors.sort = 'price_low' and m.price_display in ('starting_at', 'range')
      then m.price_from end nulls last,
    case when search_vendors.sort = 'founding' then m.founding_number end nulls last,
    m.miles nulls last, m.founding_number nulls last, (cover.storage_path is null), m.name
  limit least(greatest(search_vendors.result_limit, 1), 100)
  offset greatest(search_vendors.result_offset, 0);
$function$;
comment on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) is
  'Published vendors near a point (or anywhere when no point), filtered by category, event, text, guest capacity, price ceiling, language and a date they''re not booked on, sorted by distance (or price or founding number). Includes vendors whose service radius covers the searcher. Text falls back to close spellings when nothing matches exactly.';
revoke all on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) from public;
grant execute on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) to anon, authenticated, service_role;
