-- My business (C6, #146): "Export everything". One call gives a vendor's own
-- people all of their data on Wedded, which the app turns into a spreadsheet:
-- every lead, the numbers for each of the last 12 months, the booked and held
-- days, and the menus. Only the vendor's members.

create function private.business_export(p_vendor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'vendor', (
      select jsonb_build_object('name', v.name, 'slug', v.slug, 'city', v.city)
      from public.vendors v where v.id = p_vendor_id
    ),
    'exportedOn', today,
    -- Every lead (up to 5,000), newest first, with the event names in English.
    -- The same rules as business_leads(): the short name, email only when
    -- they asked to be emailed.
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
          'createdAt', l.created_at,
          'familyName', private.short_name(l.sender_name),
          'events', (
            select coalesce(jsonb_agg(coalesce(e.name ->> 'en', s.slug) order by s.n), '[]'::jsonb)
            from unnest(l.event_slugs) with ordinality as s (slug, n)
            left join public.events e on e.slug = s.slug
          ),
          'eventDate', l.event_date,
          'guestBand', l.guest_band,
          'location', l.location,
          'isTour', coalesce((l.details ->> 'tour')::boolean, false),
          'preferredContact', l.preferred_contact,
          'phone', l.sender_phone,
          'email', case when l.preferred_contact = 'email' then l.sender_email end,
          'replied', coalesce(exists (
            select 1
            from public.conversations c
            join public.messages m on m.conversation_id = c.id
            where c.vendor_id = l.vendor_id
              and c.family_user_id = l.user_id
              and m.sender_role = 'vendor'
              and m.created_at > l.created_at
          ), false),
          'message', l.message
        ) order by l.created_at desc)
      from (
        select i.* from public.inquiries i
        where i.vendor_id = p_vendor_id
        order by i.created_at desc
        limit 5000
      ) as l
    ), '[]'::jsonb),
    -- The numbers for each of the last 12 months, this month so far first
    'months', (
      select jsonb_agg(jsonb_build_object(
          'month', to_char(m.starts, 'YYYY-MM'),
          'views', s.views,
          'contacts', s.contacts,
          'calls', s.calls,
          'texts', s.texts,
          'whatsapps', s.whatsapps,
          'saves', s.saves,
          'inquiries', s.inquiries,
          'reelViews', s.reel_views
        ) order by m.starts desc)
      from (
        select (date_trunc('month', today) - make_interval(months => n))::date as starts
        from generate_series(0, 11) as n
      ) as m
      cross join lateral private.business_stats(
        p_vendor_id,
        m.starts,
        least((m.starts + interval '1 month')::date - 1, today)
      ) as s
    ),
    -- Booked and held days, a year back and everything ahead
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'part', d.part, 'status', d.status)
        order by d.day, d.part)
      from public.vendor_unavailable_days d
      where d.vendor_id = p_vendor_id and d.day >= today - 365
    ), '[]'::jsonb),
    'menus', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', mn.name,
          'cuisine', mn.cuisine,
          'diet', to_jsonb(mn.diet),
          'priceFrom', mn.price_from,
          'priceUnit', mn.price_unit,
          'minGuests', mn.min_guests,
          'description', mn.description,
          'sections', mn.sections
        ) order by mn.sort_order, mn.created_at)
      from public.vendor_menus mn
      where mn.vendor_id = p_vendor_id
    ), '[]'::jsonb)
  );
end;
$$;

create function public.business_export(p_vendor_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.business_export(p_vendor_id);
$$;

comment on function public.business_export is
  'Everything a vendor has on Wedded, for "Export everything": leads, the last 12 months of numbers, booked and held days, and menus. Only the vendor''s members.';

revoke all on function private.business_export, public.business_export from public;
grant execute on function private.business_export, public.business_export to authenticated;
