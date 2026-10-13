-- My business insights (C6b, #182): every number a vendor would want, for
-- their own people only.
--
-- track_search_appearances()  Counts a vendor showing up in search results
--                             (a new 'search' kind in vendor_activity_daily).
-- business_insights()         Day by day numbers, the path from seen to
--                             booked, reply speed, what families ask for, and
--                             how they compare with vendors like them nearby.
-- business_reels()            Views, likes and comments on each of their reels.
-- business_checklist()        What's missing from their listing.

alter table public.vendor_activity_daily
  drop constraint vendor_activity_daily_kind_check,
  add constraint vendor_activity_daily_kind_check check (kind in (
    'view', 'call', 'text', 'whatsapp', 'directions', 'share', 'instagram', 'website', 'search'
  ));

-- Search appearances --------------------------------------------------------------------

-- Count each published vendor in a page of results once. Up to 50 at a time;
-- stops at 50,000 a day per vendor.
create function private.track_search_appearances(p_vendor_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_vendor_ids is null or cardinality(p_vendor_ids) = 0 then
    return;
  end if;
  if cardinality(p_vendor_ids) > 50 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  insert into public.vendor_activity_daily as a (vendor_id, day, kind, count)
  select v.id, (now() at time zone 'America/Los_Angeles')::date, 'search', 1
  from public.vendors v
  where v.id in (select distinct unnest(p_vendor_ids)) and v.status = 'published'
  on conflict (vendor_id, day, kind) do update
    set count = a.count + 1
    where a.count < 50000;
end;
$$;

create function public.track_search_appearances(p_vendor_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.track_search_appearances(p_vendor_ids);
$$;

comment on function public.track_search_appearances is
  'Count published vendors showing up in a page of search results (up to 50). Anonymous.';

revoke all on function private.track_search_appearances, public.track_search_appearances from public;
grant execute on function private.track_search_appearances, public.track_search_appearances to anon, authenticated;

-- Insights ------------------------------------------------------------------------------

create function private.business_insights(p_vendor_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  starts timestamptz := p_from::timestamp at time zone 'America/Los_Angeles';
  ends timestamptz := (p_to + 1)::timestamp at time zone 'America/Los_Angeles';
  contact_kinds text[] := array['call', 'text', 'whatsapp', 'directions', 'instagram', 'website'];
  result jsonb;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  with
  activity as (
    select a.day, a.kind, a.count
    from public.vendor_activity_daily a
    where a.vendor_id = p_vendor_id and a.day between p_from and p_to
  ),
  leads as (
    select i.*,
      -- The vendor's first message in the family's chat after the inquiry
      (select min(m.created_at)
       from public.conversations c
       join public.messages m on m.conversation_id = c.id
       where c.vendor_id = i.vendor_id
         and c.family_user_id = i.user_id
         and m.sender_role = 'vendor'
         and m.created_at > i.created_at) as first_reply_at
    from public.inquiries i
    where i.vendor_id = p_vendor_id and i.created_at >= starts and i.created_at < ends
  ),
  saves as (
    select s.created_at from public.saved_vendors s
    where s.vendor_id = p_vendor_id and s.created_at >= starts and s.created_at < ends
  ),
  -- Families who booked them: a shared plan naming them, or "Yes, we booked
  -- them" from a family without one
  booked as (
    select 'w:' || b.wedding_id::text as family
    from public.wedding_bookings b
    where b.vendor_id = p_vendor_id and b.updated_at >= starts and b.updated_at < ends
    union
    select 'u:' || i.user_id::text
    from public.inquiries i
    where i.vendor_id = p_vendor_id
      and i.reply_answer = 'booked'
      and i.reply_answered_at >= starts and i.reply_answered_at < ends
      and i.user_id is not null
      and not exists (
        select 1 from public.wedding_bookings b
        join public.wedding_members wm on wm.wedding_id = b.wedding_id
        where b.vendor_id = p_vendor_id and wm.user_id = i.user_id
      )
  )
  select jsonb_build_object(
    'daily', (
      select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'views', coalesce((select sum(a.count) from activity a where a.day = d.day and a.kind = 'view'), 0),
          'contacts', coalesce((select sum(a.count) from activity a
                                where a.day = d.day and a.kind = any (contact_kinds)), 0),
          'saves', (select count(*) from saves s
                    where (s.created_at at time zone 'America/Los_Angeles')::date = d.day),
          'inquiries', (select count(*) from leads l
                        where (l.created_at at time zone 'America/Los_Angeles')::date = d.day)
        ) order by d.day)
      from (select generate_series(p_from, p_to, interval '1 day')::date as day) as d
    ),
    'funnel', jsonb_build_object(
      'searches', coalesce((select sum(a.count) from activity a where a.kind = 'search'), 0),
      'views', coalesce((select sum(a.count) from activity a where a.kind = 'view'), 0),
      'saves', (select count(*) from saves),
      'contacts', coalesce((select sum(a.count) from activity a where a.kind = any (contact_kinds)), 0),
      'inquiries', (select count(*) from leads),
      'booked', (select count(*) from booked)
    ),
    'replies', (
      select jsonb_build_object(
        'leads', count(*),
        'replied', count(first_reply_at),
        'rate', case when count(*) > 0 then round(count(first_reply_at)::numeric / count(*), 2) end,
        'medianMinutes', round((percentile_cont(0.5) within group (
          order by extract(epoch from first_reply_at - created_at) / 60
        ))::numeric)
      )
      from leads
    ),
    'asks', jsonb_build_object(
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('slug', t.slug, 'name', e.name, 'count', t.n)
          order by t.n desc, t.slug)
        from (
          select slug, count(*) as n from leads, unnest(leads.event_slugs) as slug
          group by slug order by n desc, slug limit 5
        ) as t
        join public.events e on e.slug = t.slug
      ), '[]'::jsonb),
      'guests', coalesce((
        select jsonb_agg(jsonb_build_object('band', t.guest_band, 'count', t.n) order by t.n desc, t.guest_band)
        from (
          select guest_band, count(*) as n from leads
          group by guest_band order by n desc, guest_band limit 5
        ) as t
      ), '[]'::jsonb),
      'months', coalesce((
        select jsonb_agg(jsonb_build_object('month', t.month, 'count', t.n) order by t.n desc, t.month)
        from (
          select to_char(event_date, 'YYYY-MM') as month, count(*) as n from leads
          where event_date is not null
          group by 1 order by n desc, month limit 5
        ) as t
      ), '[]'::jsonb),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('place', t.place, 'count', t.n) order by t.n desc, t.place)
        from (
          select initcap(lower(btrim(location))) as place, count(*) as n from leads
          group by 1 order by n desc, place limit 5
        ) as t
      ), '[]'::jsonb)
    )
  )
  into result;

  return result || jsonb_build_object('compare', private.business_compare(p_vendor_id, p_from, p_to));
end;
$$;

-- How a vendor's views and inquiries compare with the typical (median) vendor
-- of the same main kind within 50 miles, over the same days. Null when fewer
-- than 5 such vendors are published, so no single vendor can be worked out.
create function private.business_compare(p_vendor_id uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select v.id, v.location, vc.category_slug
    from public.vendors v
    join public.vendor_categories vc on vc.vendor_id = v.id and vc.position = 1
    where v.id = p_vendor_id and v.location is not null
  ),
  peers as (
    select v.id
    from me
    join public.vendor_categories vc on vc.category_slug = me.category_slug and vc.position = 1
    join public.vendors v on v.id = vc.vendor_id
    where v.id <> me.id
      and v.status = 'published'
      and extensions.st_dwithin(v.location, me.location, 80467)
  ),
  numbers as (
    select
      x.id,
      coalesce((select sum(a.count) from public.vendor_activity_daily a
                where a.vendor_id = x.id and a.kind = 'view' and a.day between p_from and p_to), 0) as views,
      (select count(*) from public.inquiries i
       where i.vendor_id = x.id
         and i.created_at >= p_from::timestamp at time zone 'America/Los_Angeles'
         and i.created_at < (p_to + 1)::timestamp at time zone 'America/Los_Angeles') as inquiries
    from (select id from peers union all select id from me) as x
  )
  select (
  select case when (select count(*) from peers) >= 5 then jsonb_build_object(
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name)
                 from me join public.categories c on c.slug = me.category_slug),
    'peers', (select count(*) from peers),
    'views', jsonb_build_object(
      'mine', (select views from numbers where id = p_vendor_id),
      'typical', (select round((percentile_cont(0.5) within group (order by views))::numeric)
                  from numbers where id in (select id from peers))
    ),
    'inquiries', jsonb_build_object(
      'mine', (select inquiries from numbers where id = p_vendor_id),
      'typical', (select round((percentile_cont(0.5) within group (order by inquiries))::numeric)
                  from numbers where id in (select id from peers))
    )
  ) end
  from me
  );
$$;

create function public.business_insights(p_vendor_id uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.business_insights(p_vendor_id, p_from, p_to);
$$;

comment on function public.business_insights is
  'A vendor''s insights between two California dates (up to 400 days): daily numbers, seen to booked, reply speed, what families ask for and how they compare nearby. Only the vendor''s members.';

revoke all on function private.business_insights, private.business_compare, public.business_insights from public;
grant execute on function private.business_insights, public.business_insights to authenticated;

-- Reels ---------------------------------------------------------------------------------

create function private.business_reels(p_vendor_id uuid)
returns table (
  id uuid, thumb_path text, caption text, created_at timestamptz, own boolean,
  views integer, likes integer, comments integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    coalesce((select sum(rv.count) from public.reel_views_daily rv where rv.reel_id = r.id), 0)::integer,
    (select count(*) from public.reel_likes l where l.reel_id = r.id)::integer,
    (select count(*) from public.reel_comments c where c.reel_id = r.id and not c.hidden)::integer
  from public.reels r
  where r.status = 'live'
    and (r.vendor_id = p_vendor_id or exists (
      select 1 from public.reel_vendor_tags t
      where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status <> 'declined'
    ))
  order by r.created_at desc
  limit 50;
end;
$$;

create function public.business_reels(p_vendor_id uuid)
returns table (
  id uuid, thumb_path text, caption text, created_at timestamptz, own boolean,
  views integer, likes integer, comments integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.business_reels(p_vendor_id);
$$;

comment on function public.business_reels is
  'A vendor''s live reels and the ones they''re tagged in (not declined), newest first, with views, likes and comments. Only the vendor''s members.';

revoke all on function private.business_reels, public.business_reels from public;
grant execute on function private.business_reels, public.business_reels to authenticated;

-- Listing checklist ---------------------------------------------------------------------

create function private.business_checklist(p_vendor_id uuid)
returns table (key text, done boolean, count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vendors;
  photos integer;
  needs_menus boolean;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into v from public.vendors where id = p_vendor_id;
  select count(*) into photos from public.vendor_media m where m.vendor_id = p_vendor_id;
  -- Menus matter for venues and caterers
  select exists (
    select 1 from public.vendor_categories vc
    join public.categories c on c.slug = vc.category_slug
    where vc.vendor_id = p_vendor_id and c.group_slug in ('venues', 'food')
  ) into needs_menus;

  return query values
    ('photos', photos >= 6, photos),
    ('cover', exists (select 1 from public.vendor_media m where m.vendor_id = p_vendor_id and m.is_cover), null::integer),
    ('tagline', v.tagline is not null, null),
    ('bio', v.bio is not null, null),
    ('bioPa', v.bio_pa is not null, null),
    ('price', v.price_from is not null or v.price_note is not null, null),
    ('contact', coalesce(v.call_phone, v.whatsapp_phone, v.text_phone) is not null, null),
    ('instagram', v.instagram_handle is not null, null),
    ('languages', coalesce(cardinality(v.languages), 0) > 0, null),
    ('calendar', v.calendar_updated_at is not null and v.calendar_updated_at > now() - interval '60 days', null),
    ('reel', exists (
      select 1 from public.reels r
      where r.status = 'live'
        and (r.vendor_id = p_vendor_id or exists (
          select 1 from public.reel_vendor_tags t
          where t.reel_id = r.id and t.vendor_id = p_vendor_id and t.status = 'approved'))
    ), null);

  if needs_menus then
    return query
    select 'menus', count(*) > 0, count(*)::integer
    from public.vendor_menus mn where mn.vendor_id = p_vendor_id;
  end if;
end;
$$;

create function public.business_checklist(p_vendor_id uuid)
returns table (key text, done boolean, count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.business_checklist(p_vendor_id);
$$;

comment on function public.business_checklist is
  'What a vendor''s listing has and is missing (photos, cover, tagline, bios, price, contact, Instagram, languages, a fresh calendar, a reel, and menus for venues and caterers). Only the vendor''s members.';

revoke all on function private.business_checklist, public.business_checklist from public;
grant execute on function private.business_checklist, public.business_checklist to authenticated;
