-- Follow-ups and tour times, to the database design (followups, tour_slots).
-- "Did they get back to you?" becomes a follow-up the database asks two days
-- after an inquiry goes out, instead of an answer column on the inquiry, so
-- more questions (did they show up, what did you pay) can follow the same way.
-- The visit times on a tour request become rows instead of a list inside the
-- answers. My inquiries, the vendor's leads, the chat card and the emails keep
-- their shapes.

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  question text not null check (question in ('did_they_reply')),
  asked_at timestamptz not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint followups_one_per_question unique (inquiry_id, question),
  constraint followups_answer_check
    check (answer is null or (question = 'did_they_reply' and answer in ('booked', 'deciding', 'no_reply'))),
  constraint followups_answered_at_check check ((answer is null) = (answered_at is null))
);

comment on table public.followups is
  'The app''s questions after an inquiry, one row per question. No answer counts as unknown, never against the vendor.';
comment on column public.followups.asked_at is
  'When the app asks: two days after the inquiry went out (vision §8: 48 to 72 hours).';
comment on column public.followups.answer is
  'did_they_reply: booked (Yes, we booked them), deciding (Yes, still deciding) or no_reply.';

create table public.tour_slots (
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  day date not null,
  part text not null check (part in ('morning', 'afternoon', 'evening')),
  primary key (inquiry_id, rank)
);

comment on table public.tour_slots is
  'Book a tour: up to three days the family could visit, each with a part of the day, in their order.';

-- From what's there: every sent inquiry has its question, with any answer;
-- the tour times come out of the answers
insert into public.followups (inquiry_id, question, asked_at, answer, answered_at)
select i.id, 'did_they_reply', coalesce(i.sent_at, i.created_at) + interval '2 days', i.reply_answer,
  case when i.reply_answer is not null then coalesce(i.reply_answered_at, now()) end
from public.inquiries i
where i.status = 'sent' or i.reply_answer is not null;

insert into public.tour_slots (inquiry_id, rank, day, part)
select s.inquiry_id, s.rank, s.day, s.part
from (
  select i.id as inquiry_id, row_number() over (partition by i.id order by t.n) as rank,
    (t.value ->> 'date')::date as day, t.value ->> 'part' as part
  from public.inquiries i
  cross join lateral jsonb_array_elements(case when jsonb_typeof(i.answers -> 'tourSlots') = 'array'
    then i.answers -> 'tourSlots' else '[]'::jsonb end) with ordinality as t (value, n)
  where i.kind = 'tour'
    and t.value ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$'
    and t.value ->> 'part' in ('morning', 'afternoon', 'evening')
) as s
where s.rank <= 3;
update public.inquiries set answers = answers - 'tourSlots' where answers ? 'tourSlots';

-- The answer moves off the inquiry
drop trigger stamp_reply_answer on public.inquiries;
drop trigger book_from_followup on public.inquiries;
drop function private.stamp_reply_answer();
drop policy "People can answer the follow-up on their own inquiries" on public.inquiries;
revoke update (reply_answer) on public.inquiries from authenticated;
alter table public.inquiries drop column reply_answer, drop column reply_answered_at;

-- Access: families read and answer the follow-ups on their own inquiries
-- (only the answer; the database stamps the time), and read their tour times
alter table public.followups enable row level security;
alter table public.tour_slots enable row level security;
create policy "People read the follow-ups on their own inquiries" on public.followups
  for select to authenticated
  using (exists (select 1 from public.inquiries i where i.id = inquiry_id and i.user_id = (select auth.uid())));
create policy "People answer the follow-ups on their own inquiries" on public.followups
  for update to authenticated
  using (exists (select 1 from public.inquiries i where i.id = inquiry_id and i.user_id = (select auth.uid())));
create policy "People read the tour times of their own inquiries" on public.tour_slots
  for select to authenticated
  using (exists (select 1 from public.inquiries i where i.id = inquiry_id and i.user_id = (select auth.uid())));
revoke all on public.followups, public.tour_slots from anon, authenticated;
grant select on public.followups, public.tour_slots to authenticated;
grant update (answer) on public.followups to authenticated;

-- Sending an inquiry schedules its question
create function private.ask_followups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.followups (inquiry_id, question, asked_at)
  values (new.id, 'did_they_reply', coalesce(new.sent_at, now()) + interval '2 days')
  on conflict (inquiry_id, question) do nothing;
  return null;
end;
$$;

create trigger ask_followups after insert or update of status on public.inquiries
  for each row when (new.status = 'sent') execute function private.ask_followups();

create function private.stamp_followup_answer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.answer is distinct from old.answer then
    new.answered_at := case when new.answer is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger stamp_followup_answer before update of answer on public.followups
  for each row execute function private.stamp_followup_answer();

-- "Yes, we booked them" still books the vendor in the family's plan
CREATE OR REPLACE FUNCTION private.book_from_followup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  inquiry record;
  main_category text;
  event_id uuid;
begin
  if new.answer is distinct from 'booked' or old.answer is not distinct from 'booked' then
    return new;
  end if;

  select i.id, i.user_id, i.vendor_id into inquiry
  from public.inquiries i
  where i.id = new.inquiry_id;
  if inquiry.user_id is null then
    return new;
  end if;

  select vc.category_slug into main_category
  from public.vendor_categories vc
  where vc.vendor_id = inquiry.vendor_id
  order by vc.position
  limit 1;
  if main_category is null then
    return new;
  end if;

  for event_id in
    select we.id
    from public.wedding_members m
    join public.wedding_events we on we.wedding_id = m.wedding_id
    where m.user_id = inquiry.user_id
      and m.role in ('owner', 'editor')
      and we.event_slug = any (private.inquiry_event_slugs(inquiry.id))
  loop
    perform private.book_slot(event_id, main_category, inquiry.vendor_id, inquiry.id, inquiry.user_id, false);
  end loop;

  return new;
end;
$function$;

create trigger book_from_followup after update of answer on public.followups
  for each row execute function private.book_from_followup();

-- A tour's times as the leads, the chat card and the emails print them
create function private.inquiry_tour_slots(p_inquiry_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('tourSlots',
      jsonb_agg(jsonb_build_object('date', ts.day, 'part', ts.part) order by ts.rank))
    from public.tour_slots ts
    where ts.inquiry_id = p_inquiry_id
    having count(*) > 0
  ), '{}'::jsonb);
$$;

revoke all on function private.inquiry_tour_slots from public, anon, authenticated;
grant execute on function private.inquiry_tour_slots to service_role;

-- Public stats count the follow-up answers
CREATE OR REPLACE FUNCTION private.vendor_public_stats(p_vendor_id uuid)
 RETURNS TABLE(saved_by integer, replied integer, answered integer, booked_by integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with vendor as (
    select v.id from public.vendors v where v.id = p_vendor_id and v.status = 'published'
  ),
  saves as (
    select count(distinct s.user_id)::integer as n
    from public.saved_vendors s
    join vendor on vendor.id = s.vendor_id
  ),
  answers as (
    select
      (count(*) filter (where f.answer in ('booked', 'deciding')))::integer as replied,
      (count(*) filter (where f.answer is not null))::integer as answered
    from public.inquiries i
    join vendor on vendor.id = i.vendor_id
    join public.followups f on f.inquiry_id = i.id and f.question = 'did_they_reply'
  ),
  booked as (
    select count(distinct we.wedding_id)::integer as n
    from public.bookings b
    join vendor on vendor.id = b.vendor_id
    join public.wedding_slots s on s.id = b.slot_id
    join public.wedding_events we on we.id = s.wedding_event_id
    where b.status <> 'canceled'
  )
  select
    case when saves.n >= 5 then saves.n end,
    case when answers.answered >= 5 then answers.replied end,
    case when answers.answered >= 5 then answers.answered end,
    case when booked.n >= 5 then booked.n end
  from saves, answers, booked
  where exists (select 1 from vendor);
$function$
;

-- and so does the scorecard
CREATE OR REPLACE FUNCTION public.vendor_scorecard(p_vendor_id uuid, p_from date, p_to date)
 RETURNS TABLE(views integer, calls integer, texts integer, whatsapps integer, directions integer, shares integer, instagram integer, website integer, saves integer, inquiries integer, replied integer, answered integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with activity as (
    select kind, sum(count)::integer as n
    from public.vendor_activity_daily
    where vendor_id = p_vendor_id and day between p_from and p_to
    group by kind
  ),
  window_bounds as (
    select
      (p_from::timestamp at time zone 'America/Los_Angeles') as starts,
      ((p_to + 1)::timestamp at time zone 'America/Los_Angeles') as ends
  )
  select
    coalesce((select n from activity where kind = 'view'), 0),
    coalesce((select n from activity where kind = 'call'), 0),
    coalesce((select n from activity where kind = 'text'), 0),
    coalesce((select n from activity where kind = 'whatsapp'), 0),
    coalesce((select n from activity where kind = 'directions'), 0),
    coalesce((select n from activity where kind = 'share'), 0),
    coalesce((select n from activity where kind = 'instagram'), 0),
    coalesce((select n from activity where kind = 'website'), 0),
    (select count(*)::integer from public.saved_vendors s, window_bounds w
     where s.vendor_id = p_vendor_id and s.created_at >= w.starts and s.created_at < w.ends),
    (select count(*)::integer from public.inquiries i, window_bounds w
     where i.vendor_id = p_vendor_id and i.created_at >= w.starts and i.created_at < w.ends),
    (select count(*)::integer
     from public.inquiries i
     join public.followups f on f.inquiry_id = i.id and f.question = 'did_they_reply', window_bounds w
     where i.vendor_id = p_vendor_id and i.created_at >= w.starts and i.created_at < w.ends
       and f.answer in ('booked', 'deciding')),
    (select count(*)::integer
     from public.inquiries i
     join public.followups f on f.inquiry_id = i.id and f.question = 'did_they_reply', window_bounds w
     where i.vendor_id = p_vendor_id and i.created_at >= w.starts and i.created_at < w.ends
       and f.answer is not null);
$function$
;

-- Insights count "Yes, we booked them" from the follow-ups
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
    join public.followups f on f.inquiry_id = i.id and f.question = 'did_they_reply'
    where i.vendor_id = p_vendor_id
      and f.answer = 'booked'
      and f.answered_at >= starts and f.answered_at < ends
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
$function$
;

-- A vendor's leads show the tour times again
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
    i.answers || case when i.kind = 'tour' then '{"tour": true}'::jsonb || private.inquiry_tour_slots(i.id) else '{}'::jsonb end,
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
$function$
;

-- create_inquiry() keeps its input; the tour times become rows
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
    btrim(p_message), p_preferred_contact, coalesce(p_details, '{}') - 'tour' - 'tourSlots',
    btrim(p_sender_name), p_sender_phone, p_sender_email, v_channel, v_status
  )
  returning id into v_id;

  insert into public.inquiry_events (inquiry_id, event_slug, wedding_event_id, position)
  select v_id, s.slug, we.id, min(s.n)
  from unnest(coalesce(p_event_slugs, '{}')) with ordinality as s (slug, n)
  left join public.wedding_events we on we.wedding_id = v_wedding and we.event_slug = s.slug
  group by s.slug, we.id;

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

revoke all on function public.create_inquiry from public, anon, authenticated;
grant execute on function public.create_inquiry to service_role;
