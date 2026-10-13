-- My business (C6, #146): what a vendor's own people see about their listing.
--
-- reel_views_daily    Anonymous daily view counts per reel, from track_reel_view().
-- my_businesses()     The vendors the signed-in person runs, drafts included.
-- business_stats()    A vendor's numbers between two California dates: page
--                     views, contact taps, saves, inquiries and reel views.
-- business_leads()    The inquiries a vendor received, newest first, with the
--                     chat they started and whether the vendor has replied.
--
-- Only the vendor's members (vendor_members) can read their stats and leads.

create table public.reel_views_daily (
  reel_id uuid not null references public.reels (id) on delete cascade,
  -- The California day
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (reel_id, day)
);

comment on table public.reel_views_daily is
  'Anonymous daily view counts per reel. No user data. Written by track_reel_view(); read through business_stats().';

alter table public.reel_views_daily enable row level security;
-- No policies and no grants for the API roles.
revoke all on public.reel_views_daily from anon, authenticated;

-- Count one view of a live reel. Stops at 50,000 a day per reel.
create function private.track_reel_view(p_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.reels where id = p_reel_id and status = 'live') then
    return;
  end if;
  insert into public.reel_views_daily as r (reel_id, day, count)
  values (p_reel_id, (now() at time zone 'America/Los_Angeles')::date, 1)
  on conflict (reel_id, day) do update
    set count = r.count + 1
    where r.count < 50000;
end;
$$;

create function public.track_reel_view(p_reel_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.track_reel_view(p_reel_id);
$$;

comment on function public.track_reel_view is
  'Count one view of a live reel. Anonymous.';

revoke all on function private.track_reel_view, public.track_reel_view from public;
grant execute on function private.track_reel_view, public.track_reel_view to anon, authenticated;

-- The vendors I run ------------------------------------------------------------------------

create function private.my_businesses()
returns table (id uuid, slug text, name text, name_pa text, status text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.slug, v.name, v.name_pa, v.status, m.role
  from public.vendor_members m
  join public.vendors v on v.id = m.vendor_id
  where m.user_id = (select auth.uid())
  order by v.name;
$$;

create function public.my_businesses()
returns table (id uuid, slug text, name text, name_pa text, status text, role text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_businesses();
$$;

comment on function public.my_businesses is
  'The vendors the signed-in person runs (owner or staff), drafts included.';

revoke all on function private.my_businesses, public.my_businesses from public;
grant execute on function private.my_businesses, public.my_businesses to authenticated;

-- A vendor's numbers -----------------------------------------------------------------------

create function private.business_stats(p_vendor_id uuid, p_from date, p_to date)
returns table (
  views integer, calls integer, texts integer, whatsapps integer, directions integer,
  instagram integer, website integer, shares integer, contacts integer,
  saves integer, inquiries integer, reel_views integer
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
    (select coalesce(sum(rv.count), 0)::integer from public.reel_views_daily rv
     where rv.reel_id in (select id from vendor_reels) and rv.day between p_from and p_to)
  from counts c;
end;
$$;

create function public.business_stats(p_vendor_id uuid, p_from date, p_to date)
returns table (
  views integer, calls integer, texts integer, whatsapps integer, directions integer,
  instagram integer, website integer, shares integer, contacts integer,
  saves integer, inquiries integer, reel_views integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.business_stats(p_vendor_id, p_from, p_to);
$$;

comment on function public.business_stats is
  'A vendor''s numbers between two California dates (inclusive, up to 400 days apart). Only the vendor''s members.';

revoke all on function private.business_stats, public.business_stats from public;
grant execute on function private.business_stats, public.business_stats to authenticated;

-- A vendor's leads -------------------------------------------------------------------------

create function private.business_leads(
  p_vendor_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid, created_at timestamptz, family_name text, event_slugs text[],
  event_date date, start_time time, guest_band text, location text, message text,
  details jsonb, is_tour boolean, preferred_contact text, phone text, email text,
  conversation_id uuid, replied boolean
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
    i.id,
    i.created_at,
    -- Null once the family deleted their account (the sender is scrubbed)
    private.short_name(i.sender_name),
    i.event_slugs,
    i.event_date,
    i.start_time,
    i.guest_band,
    i.location,
    i.message,
    i.details,
    coalesce((i.details ->> 'tour')::boolean, false),
    i.preferred_contact,
    i.sender_phone,
    -- Only when they asked to be emailed
    case when i.preferred_contact = 'email' then i.sender_email end,
    c.id,
    coalesce(exists (
      select 1 from public.messages m
      where m.conversation_id = c.id
        and m.sender_role = 'vendor'
        and m.created_at > i.created_at
    ), false)
  from public.inquiries i
  left join public.conversations c
    on c.vendor_id = i.vendor_id and c.family_user_id = i.user_id
  where i.vendor_id = p_vendor_id
    and (p_before is null or i.created_at < p_before)
  order by i.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create function public.business_leads(
  p_vendor_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid, created_at timestamptz, family_name text, event_slugs text[],
  event_date date, start_time time, guest_band text, location text, message text,
  details jsonb, is_tour boolean, preferred_contact text, phone text, email text,
  conversation_id uuid, replied boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.business_leads(p_vendor_id, p_before, p_limit);
$$;

comment on function public.business_leads is
  'The inquiries a vendor received, newest first (up to 100 a page, before a time), with their chat and whether the vendor replied. Only the vendor''s members.';

revoke all on function private.business_leads, public.business_leads from public;
grant execute on function private.business_leads, public.business_leads to authenticated;
