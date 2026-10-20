-- A retry after the email failed is the same inquiry (#349). The failed row
-- takes the new details and goes out again, so "Vendors you asked" and the
-- vendor's chat show it once instead of a new "Not sent" row and a second card
-- on every try. Only create_inquiry() changes: the failed inquiry's id is reused
-- (an upsert, so the chat-card insert trigger doesn't fire again) and its card
-- is rewritten with the new details.

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
  v_retry boolean;
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

  -- A retry after the email failed is the same inquiry: the failed row takes the
  -- new details and goes out again, so the family's list and the vendor's chat
  -- show it once
  select i.id into v_id
  from public.inquiries i
  where i.user_id = p_user_id and i.vendor_id = p_vendor_id and i.status = 'failed'
  order by i.created_at desc
  limit 1;
  v_retry := v_id is not null;
  if v_retry then
    delete from public.inquiry_events where inquiry_id = v_id;
    delete from public.tour_slots where inquiry_id = v_id;
  end if;

  insert into public.inquiries as i (
    id, user_id, vendor_id, wedding_id, kind, event_date, date_flex, start_time, guest_band,
    city_slug, venue_text, message, preferred_contact, answers, sender_name, sender_phone,
    sender_email, channel, status
  ) values (
    coalesce(v_id, gen_random_uuid()), p_user_id, p_vendor_id, v_wedding,
    case when p_details -> 'tour' = 'true'::jsonb then 'tour' else 'price_date' end,
    p_event_date,
    case when p_event_date is null then 'not_sure' else 'exact' end,
    p_start_time, p_guest_band, v_city,
    case when v_city is null then btrim(p_location) end,
    btrim(p_message), p_preferred_contact, coalesce(p_details, '{}') - 'tour' - 'tourSlots',
    btrim(p_sender_name), p_sender_phone, p_sender_email, v_channel, v_status
  )
  on conflict (id) do update set
    (wedding_id, kind, event_date, date_flex, start_time, guest_band, city_slug, venue_text, message,
     preferred_contact, answers, sender_name, sender_phone, sender_email, channel, status, failure)
    = (excluded.wedding_id, excluded.kind, excluded.event_date, excluded.date_flex, excluded.start_time,
       excluded.guest_band, excluded.city_slug, excluded.venue_text, excluded.message,
       excluded.preferred_contact, excluded.answers, excluded.sender_name, excluded.sender_phone,
       excluded.sender_email, excluded.channel, excluded.status, null)
  returning i.id into v_id;

  insert into public.inquiry_events (inquiry_id, event_slug, wedding_event_id, position)
  select v_id, s.slug, we.id, min(s.n)
  from unnest(coalesce(p_event_slugs, '{}')) with ordinality as s (slug, n)
  left join public.wedding_events we on we.wedding_id = v_wedding and we.event_slug = s.slug
  group by s.slug, we.id;

  -- The retry's card says what they're asking now (a new inquiry's card comes
  -- from the inquiry_to_conversation trigger)
  if v_retry then
    update public.messages m
    set body = i.message,
      data = jsonb_strip_nulls(jsonb_build_object(
        'eventSlugs', to_jsonb(private.inquiry_event_slugs(i.id)),
        'eventDate', i.event_date,
        'startTime', i.start_time,
        'guestBand', i.guest_band,
        'location', private.inquiry_place(i.city_slug, i.venue_id, i.venue_text),
        'details', i.answers || case when i.kind = 'tour' then '{"tour": true}'::jsonb else '{}'::jsonb end
      ))
    from public.inquiries i
    where i.id = v_id and m.inquiry_id = v_id and m.kind = 'booking';
  end if;

  -- Up to three visit times on a tour request (send-inquiry checked the days are
  -- real); the chat card shows them like the leads
  insert into public.tour_slots (inquiry_id, rank, day, part)
  select v_id, s.rank, s.day, s.part
  from (
    select row_number() over (order by t.n) as rank, (t.value ->> 'date')::date as day, t.value ->> 'part' as part
    from jsonb_array_elements(case when jsonb_typeof(p_details -> 'tourSlots') = 'array'
      then p_details -> 'tourSlots' else '[]'::jsonb end) with ordinality as t (value, n)
    where p_details -> 'tour' = 'true'::jsonb
      and t.value ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$'
      and t.value ->> 'part' in ('morning', 'afternoon', 'evening')
  ) as s
  where s.rank <= 3;
  if found then
    update public.messages
    set data = jsonb_set(data, '{details}', (data -> 'details') || private.inquiry_tour_slots(v_id))
    where inquiry_id = v_id and kind = 'booking';
  end if;

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
$function$
;

-- create_inquiry() runs as the service role and now rewrites the card itself
grant execute on function private.inquiry_event_slugs, private.inquiry_place to service_role;
