-- Inquiries, to the database design (inquiries, inquiry_events): the events an
-- inquiry is about become rows tied to the family's own wedding events; the
-- kind of ask (price and date, or a tour) and its answers to the vendor type's
-- questions get their own columns; the place is a listed city, a listed venue
-- or the words they typed; and an inquiry knows the wedding it's for and how
-- firm its date is. The language is gone (English only).
--
-- create_inquiry() keeps taking what the app sends (a place typed as text,
-- the type's answers with a tour flag), and the vendor's leads, the export,
-- the insights and the chat card keep their shapes, so the screens and the
-- emails don't change. The send status and the family's follow-up answer
-- stay on the inquiry until deliveries and followups have their own tables.

create table public.inquiry_events (
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  event_slug text not null references public.events (slug) on update cascade,
  wedding_event_id uuid references public.wedding_events (id) on delete set null,
  position smallint not null default 0,
  primary key (inquiry_id, event_slug)
);

comment on table public.inquiry_events is
  'Which events an inquiry is about (none: Not sure), and the family''s own wedding event when they have it.';
comment on column public.inquiry_events.position is
  'The order the family picked them in, which the vendor''s leads and the export keep.';

create index inquiry_events_event_slug_idx on public.inquiry_events (event_slug);
create index inquiry_events_wedding_event_id_idx on public.inquiry_events (wedding_event_id);

alter table public.inquiries
  add column wedding_id uuid references public.weddings (id) on delete set null,
  add column kind text not null default 'price_date' check (kind in ('price_date', 'tour')),
  add column date_flex text not null default 'exact' check (date_flex in ('exact', 'month', 'not_sure')),
  add column city_slug text references public.cities (slug) on update cascade,
  add column venue_id uuid references public.vendors (id) on delete set null,
  add column venue_text text check (length(btrim(venue_text)) between 1 and 120);

comment on column public.inquiries.kind is 'price_date: ask about price and date; tour: book a visit.';
comment on column public.inquiries.date_flex is 'How firm the date is: exact, a month, or not sure yet (no date).';
comment on column public.inquiries.venue_text is 'Where it is, in their words, when it isn''t a listed city or venue.';

create index inquiries_wedding_id_idx on public.inquiries (wedding_id);
create index inquiries_city_slug_idx on public.inquiries (city_slug);
create index inquiries_venue_id_idx on public.inquiries (venue_id);

-- The events, the wedding, the kind, the date and the place, from what's there
insert into public.inquiry_events (inquiry_id, event_slug, wedding_event_id, position)
select i.id, s.slug, we.id, s.n
from public.inquiries i
cross join lateral unnest(i.event_slugs) with ordinality as s (slug, n)
left join public.wedding_events we
  on we.wedding_id = private.primary_wedding(i.user_id) and we.event_slug = s.slug
where exists (select 1 from public.events e where e.slug = s.slug)
on conflict do nothing;

update public.inquiries i set
  wedding_id = private.primary_wedding(i.user_id),
  kind = case when i.details -> 'tour' = 'true'::jsonb then 'tour' else 'price_date' end,
  date_flex = case when i.event_date is null then 'not_sure' else 'exact' end,
  city_slug = (
    select c.slug from public.cities c
    where lower(c.name) = lower(btrim(i.location)) or lower(btrim(i.location)) = any (c.nicknames)
    limit 1
  );
update public.inquiries
set venue_text = left(btrim(location), 120)
where city_slug is null and nullif(btrim(location), '') is not null;

alter table public.inquiries rename column details to answers;
alter table public.inquiries rename constraint inquiries_details_check to inquiries_answers_check;
update public.inquiries set answers = answers - 'tour' where answers ? 'tour';

comment on column public.inquiries.answers is 'Answers to the vendor type''s own questions.';

alter table public.inquiries
  drop column event_slugs,
  drop column location,
  drop column language;

alter table public.inquiry_events enable row level security;
create policy "People read the events of their own inquiries" on public.inquiry_events
  for select to authenticated
  using (exists (select 1 from public.inquiries i where i.id = inquiry_id));
revoke all on public.inquiry_events from anon, authenticated;
grant select on public.inquiry_events to authenticated;

-- An inquiry's events and place, the way the leads, the export and the chat card show them
create function private.inquiry_event_slugs(p_inquiry_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(ie.event_slug order by ie.position, ie.event_slug), '{}')
  from public.inquiry_events ie
  where ie.inquiry_id = p_inquiry_id;
$$;

create function private.inquiry_place(p_city_slug text, p_venue_id uuid, p_venue_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select v.name from public.vendors v where v.id = p_venue_id),
    p_venue_text,
    (select c.name from public.cities c where c.slug = p_city_slug)
  );
$$;

revoke all on function private.inquiry_event_slugs, private.inquiry_place from public, anon, authenticated;

-- create_inquiry() runs as the service role (the send-inquiry function), and finds the family's wedding
grant execute on function private.primary_wedding to service_role;

-- The chat card fills in the events as they're added (the inquiry comes first)
create function private.inquiry_events_to_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set data = data || jsonb_build_object('eventSlugs', to_jsonb(private.inquiry_event_slugs(new.inquiry_id)))
  where inquiry_id = new.inquiry_id and kind = 'booking';
  return null;
end;
$$;

create trigger inquiry_events_to_card after insert on public.inquiry_events
  for each row execute function private.inquiry_events_to_card();

-- create_inquiry takes the same request as before, without the language
drop function public.create_inquiry(uuid, uuid, text[], date, time without time zone, text, text, text, text, text, jsonb, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.create_inquiry(p_user_id uuid, p_vendor_id uuid, p_event_slugs text[], p_event_date date, p_start_time time without time zone, p_guest_band text, p_location text, p_message text, p_preferred_contact text, p_details jsonb, p_sender_name text, p_sender_phone text, p_sender_email text, p_send_again boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_vendor record;
  v_private record;
  v_previous timestamptz;
  v_hourly integer;
  v_daily integer;
  v_status text;
  v_channel text;
  v_id uuid;
  v_city text;
  v_wedding uuid;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  -- One request at a time per person, so two taps can't slip past the limits
  perform pg_advisory_xact_lock(hashtextextended('inquiry:' || p_user_id::text, 0));

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.adult_confirmed_at is not null
  ) then
    return jsonb_build_object('outcome', 'needs_profile');
  end if;

  select v.id, v.name,
    (select c.value from public.vendor_contacts c where c.vendor_id = v.id and c.kind = 'call') as call_phone,
    (select c.value from public.vendor_contacts c where c.vendor_id = v.id and c.kind = 'text') as text_phone,
    (select c.value from public.vendor_contacts c where c.vendor_id = v.id and c.kind = 'whatsapp') as whatsapp_phone
  into v_vendor
  from public.vendors v
  where v.id = p_vendor_id and v.status = 'published';
  if not found then
    return jsonb_build_object('outcome', 'vendor_not_found');
  end if;

  if exists (
    select 1 from unnest(coalesce(p_event_slugs, '{}')) as s (slug)
    where not exists (select 1 from public.events e where e.slug = s.slug)
  ) or cardinality(coalesce(p_event_slugs, '{}')) > 10 then
    return jsonb_build_object('outcome', 'invalid', 'field', 'eventSlugs');
  end if;

  if p_event_date is not null and p_event_date < v_today then
    return jsonb_build_object('outcome', 'invalid', 'field', 'eventDate');
  end if;

  select max(i.created_at) into v_previous
  from public.inquiries i
  where i.user_id = p_user_id and i.vendor_id = p_vendor_id
    and i.status <> 'failed' and i.created_at > now() - interval '24 hours';
  if v_previous is not null and not coalesce(p_send_again, false) then
    return jsonb_build_object('outcome', 'duplicate', 'previous_at', v_previous);
  end if;

  select
    count(*) filter (where i.created_at > now() - interval '1 hour'),
    count(*)
  into v_hourly, v_daily
  from public.inquiries i
  where i.user_id = p_user_id and i.status <> 'failed'
    and i.created_at > now() - interval '24 hours';
  if v_hourly >= 5 then
    return jsonb_build_object('outcome', 'rate_limited', 'limit', 'hour');
  end if;
  if v_daily >= 15 then
    return jsonb_build_object('outcome', 'rate_limited', 'limit', 'day');
  end if;

  select vp.email, vp.checks_email into v_private
  from public.vendor_private vp
  where vp.vendor_id = p_vendor_id;
  v_channel := case
    when v_private.email is not null and coalesce(v_private.checks_email, true) then 'email'
    else 'relay'
  end;

  v_status := case when public.inquiry_emails_left_today() <= 0 then 'queued' else 'sending' end;

  -- The place they typed is a listed city when it names one, else their words
  select c.slug into v_city
  from public.cities c
  where lower(c.name) = lower(btrim(p_location)) or lower(btrim(p_location)) = any (c.nicknames)
  limit 1;
  v_wedding := private.primary_wedding(p_user_id);

  insert into public.inquiries (
    user_id, vendor_id, wedding_id, kind, event_date, date_flex, start_time, guest_band,
    city_slug, venue_text, message, preferred_contact, answers, sender_name, sender_phone,
    sender_email, channel, status
  ) values (
    p_user_id, p_vendor_id, v_wedding,
    case when p_details -> 'tour' = 'true'::jsonb then 'tour' else 'price_date' end,
    p_event_date,
    case when p_event_date is null then 'not_sure' else 'exact' end,
    p_start_time, p_guest_band, v_city,
    case when v_city is null then btrim(p_location) end,
    btrim(p_message), p_preferred_contact, coalesce(p_details, '{}') - 'tour',
    btrim(p_sender_name), p_sender_phone, p_sender_email, v_channel, v_status
  )
  returning id into v_id;

  insert into public.inquiry_events (inquiry_id, event_slug, wedding_event_id, position)
  select v_id, s.slug, we.id, min(s.n)
  from unnest(coalesce(p_event_slugs, '{}')) with ordinality as s (slug, n)
  left join public.wedding_events we on we.wedding_id = v_wedding and we.event_slug = s.slug
  group by s.slug, we.id;

  -- Asking a vendor saves them under those events (S11 "On send")
  perform private.save_for(p_user_id, p_vendor_id, s.slug, 'inquiry')
  from unnest(case when cardinality(coalesce(p_event_slugs, '{}')) = 0 then array[null::text]
    else p_event_slugs end) as s (slug);

  return jsonb_build_object(
    'outcome', 'created',
    'inquiry_id', v_id,
    'status', v_status,
    'channel', v_channel,
    'vendor_name', v_vendor.name,
    'vendor_email', case when v_channel = 'email' then v_private.email end,
    'vendor_phone', coalesce(v_vendor.whatsapp_phone, v_vendor.text_phone, v_vendor.call_phone)
  );
end;
$function$;
revoke all on function public.create_inquiry from public, anon, authenticated;
grant execute on function public.create_inquiry to service_role;

-- The chat card reads the place and answers from their columns
CREATE OR REPLACE FUNCTION private.inquiry_to_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  conversation uuid;
begin
  if new.user_id is null then
    return new;
  end if;
  insert into public.conversations as c (vendor_id, family_user_id, family_name, family_read_at)
  values (new.vendor_id, new.user_id, private.short_name(new.sender_name), now())
  on conflict (vendor_id, family_user_id) do update
    set last_message_at = clock_timestamp(), family_read_at = clock_timestamp()
  returning c.id into conversation;

  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, inquiry_id, created_at)
  values (conversation, new.user_id, 'family', 'booking', new.message,
    jsonb_strip_nulls(jsonb_build_object(
      'eventSlugs', to_jsonb(private.inquiry_event_slugs(new.id)),
      'eventDate', new.event_date,
      'startTime', new.start_time,
      'guestBand', new.guest_band,
      'location', private.inquiry_place(new.city_slug, new.venue_id, new.venue_text),
      'details', new.answers || case when new.kind = 'tour' then '{"tour": true}'::jsonb else '{}'::jsonb end
    )),
    new.id, clock_timestamp());
  return new;
end;
$function$;

-- A vendor's leads keep their shape
CREATE OR REPLACE FUNCTION private.business_leads(p_vendor_id uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, family_name text, event_slugs text[], event_date date, start_time time without time zone, guest_band text, location text, message text, details jsonb, is_tour boolean, preferred_contact text, phone text, email text, conversation_id uuid, replied boolean)
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
    i.id,
    i.created_at,
    -- Null once the family deleted their account (the sender is scrubbed)
    private.short_name(i.sender_name),
    private.inquiry_event_slugs(i.id),
    i.event_date,
    i.start_time,
    i.guest_band,
    private.inquiry_place(i.city_slug, i.venue_id, i.venue_text),
    i.message,
    i.answers || case when i.kind = 'tour' then '{"tour": true}'::jsonb else '{}'::jsonb end,
    i.kind = 'tour',
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
$function$;

-- Insights count the events and places asked about
CREATE OR REPLACE FUNCTION private.business_insights(p_vendor_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select 'w:' || we.wedding_id::text as family
    from public.bookings b
    join public.wedding_slots s on s.id = b.slot_id
    join public.wedding_events we on we.id = s.wedding_event_id
    where b.vendor_id = p_vendor_id and b.status <> 'canceled'
      and b.updated_at >= starts and b.updated_at < ends
    union
    select 'u:' || i.user_id::text
    from public.inquiries i
    where i.vendor_id = p_vendor_id
      and i.reply_answer = 'booked'
      and i.reply_answered_at >= starts and i.reply_answered_at < ends
      and i.user_id is not null
      and not exists (
        select 1 from public.bookings b
        join public.wedding_slots s on s.id = b.slot_id
        join public.wedding_events we on we.id = s.wedding_event_id
        join public.wedding_members wm on wm.wedding_id = we.wedding_id
        where b.vendor_id = p_vendor_id and b.status <> 'canceled' and wm.user_id = i.user_id
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
          select ie.event_slug as slug, count(*) as n
          from leads join public.inquiry_events ie on ie.inquiry_id = leads.id
          group by ie.event_slug order by n desc, slug limit 5
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
          select initcap(lower(btrim(private.inquiry_place(city_slug, venue_id, venue_text)))) as place,
            count(*) as n
          from leads
          group by 1 order by n desc, place limit 5
        ) as t
      ), '[]'::jsonb)
    )
  )
  into result;

  return result || jsonb_build_object('compare', private.business_compare(p_vendor_id, p_from, p_to));
end;
$function$;

-- The export's leads keep their shape
CREATE OR REPLACE FUNCTION private.business_export(p_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'vendor', (
      select jsonb_build_object('name', v.name, 'slug', v.slug,
        'city', (select c.name from public.cities c where c.slug = v.base_city_slug))
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
            from unnest(private.inquiry_event_slugs(l.id)) with ordinality as s (slug, n)
            left join public.events e on e.slug = s.slug
          ),
          'eventDate', l.event_date,
          'guestBand', l.guest_band,
          'location', private.inquiry_place(l.city_slug, l.venue_id, l.venue_text),
          'isTour', l.kind = 'tour',
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
      from public.vendor_days d
      where d.vendor_id = p_vendor_id and d.day >= today - 365 and d.status <> 'open'
    ), '[]'::jsonb),
    'menus', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', mn.name,
          'cuisine', mn.cuisine,
          'diet', to_jsonb(mn.diet_tags),
          -- The export speaks whole dollars, like the listing editor
          'priceFrom', mn.price_from_cents / 100,
          'priceUnit', mn.price_unit,
          'minGuests', mn.min_guests,
          'description', mn.description,
          'sections', coalesce((
            select jsonb_agg(jsonb_build_object('title', sec.section, 'items', sec.items) order by sec.first)
            from (
              select it.section, min(it.sort_order) as first,
                jsonb_agg(jsonb_build_object('name', it.name) order by it.sort_order) as items
              from public.menu_items it
              where it.menu_id = mn.id
              group by it.section
            ) sec
          ), '[]'::jsonb)
        ) order by mn.sort_order, mn.created_at)
      from public.vendor_menus mn
      where mn.vendor_id = p_vendor_id
    ), '[]'::jsonb)
  );
end;
$function$;

-- "Yes, we booked them" books the inquiry's events
CREATE OR REPLACE FUNCTION private.book_from_followup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  main_category text;
  event_id uuid;
begin
  if new.reply_answer is distinct from 'booked'
    or old.reply_answer is not distinct from 'booked'
    or new.user_id is null then
    return new;
  end if;

  select vc.category_slug into main_category
  from public.vendor_categories vc
  where vc.vendor_id = new.vendor_id
  order by vc.position
  limit 1;
  if main_category is null then
    return new;
  end if;

  for event_id in
    select we.id
    from public.wedding_members m
    join public.wedding_events we on we.wedding_id = m.wedding_id
    where m.user_id = new.user_id
      and m.role in ('owner', 'editor')
      and we.event_slug = any (private.inquiry_event_slugs(new.id))
  loop
    perform private.book_slot(event_id, main_category, new.vendor_id, new.id, new.user_id, false);
  end loop;

  return new;
end;
$function$;
