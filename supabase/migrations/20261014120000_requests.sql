-- Requests and proposals (R1, #218; the plan is #217). A family planning a
-- wedding posts a Request ("Looking for a dhol player for our Jaago · Sat Jun
-- 12 · Yuba City · ~250 guests · $500–1,000"). Vendors on Wedded Pro see open
-- requests that fit them in Families looking and send one proposal each; the
-- family compares them and accepts one, which opens their chat. Free vendors
-- only get counts (the teaser).
--
-- vendor_subscriptions   A vendor's Wedded Pro subscription (written by the
--                        billing functions, R3); private.is_pro() reads it.
-- wedding_requests       What a family is looking for. Members of the wedding
--                        read them; vendors only through families_looking().
-- request_proposals      One per vendor per request. The family and the
--                        vendor's people read their own.
-- messages kind 'proposal'  The accepted proposal in the chat, from the vendor,
--                        and the family's "accepted" line.
--
-- Privacy: vendors see the short name ("Harjit K."), the town, the event,
-- date, guests, budget and note; never contact details. Contact starts only
-- when the family accepts, so "vendors only reply" still holds.

-- Wedded Pro -------------------------------------------------------------------------------

create table public.vendor_subscriptions (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  plan text not null default 'pro' check (plan = 'pro'),
  -- Stripe's subscription statuses that matter here
  status text not null
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vendor_subscriptions is
  'A vendor''s Wedded Pro subscription ($50 a month through Stripe on the website). The vendor''s people read it; the billing functions write it.';

alter table public.vendor_subscriptions enable row level security;

create policy "A vendor's people see its subscription" on public.vendor_subscriptions
  for select to authenticated
  using ((select private.is_vendor_member(vendor_id)));

revoke all on public.vendor_subscriptions from anon, authenticated;
grant select on public.vendor_subscriptions to authenticated;

-- Pro while the subscription is paid up (a failed renewal keeps it 3 more days)
create function private.is_pro(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendor_subscriptions s
    where s.vendor_id = p_vendor_id
      and (
        s.status in ('active', 'trialing')
        or (s.status = 'past_due' and s.current_period_end > now() - interval '3 days')
      )
  );
$$;

-- Requests ---------------------------------------------------------------------------------

create table public.wedding_requests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  category_slug text not null references public.categories (slug) on update cascade,
  event_slug text references public.events (slug) on update cascade on delete set null,
  -- The event's date (or the wedding's); null while not fixed
  event_date date,
  guest_band text
    check (guest_band in ('under_50', '50_100', '100_250', '250_500', '500_plus', 'not_sure')),
  budget_min_cents integer check (budget_min_cents between 0 and 100000000),
  budget_max_cents integer check (budget_max_cents between 100 and 100000000),
  note text not null check (length(btrim(note)) between 1 and 500),
  city_slug text not null references public.cities (slug) on update cascade,
  status text not null default 'open' check (status in ('open', 'booked', 'closed')),
  proposal_count integer not null default 0 check (proposal_count >= 0),
  -- Closes by itself the day after the event, or after 90 days without a date
  expires_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_requests_budget_order
    check (budget_min_cents is null or budget_max_cents is null or budget_min_cents <= budget_max_cents)
);

comment on table public.wedding_requests is
  'What a family is looking for, posted to Pro vendors (opt-in). Wedding members read them; vendors only through families_looking().';

create index wedding_requests_wedding_idx on public.wedding_requests (wedding_id, created_at desc);
create index wedding_requests_open_idx on public.wedding_requests (category_slug, created_at desc)
  where status = 'open';

alter table public.wedding_requests enable row level security;

create policy "Members of the wedding see its requests" on public.wedding_requests
  for select to authenticated
  using (exists (
    select 1 from public.wedding_members m
    where m.wedding_id = wedding_requests.wedding_id and m.user_id = (select auth.uid())
  ));

revoke all on public.wedding_requests from anon, authenticated;
grant select on public.wedding_requests to authenticated;

create table public.request_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.wedding_requests (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  sent_by uuid references auth.users (id) on delete set null,
  price_cents integer check (price_cents between 100 and 100000000),
  price_unit text check (price_unit in ('event', 'hour', 'person', 'plate', 'day')),
  note text not null check (length(btrim(note)) between 1 and 600),
  menu_id uuid references public.vendor_menus (id) on delete set null,
  reel_id uuid references public.reels (id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  conversation_id uuid references public.conversations (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint request_proposals_one_per_vendor unique (request_id, vendor_id),
  constraint request_proposals_price_has_unit check (price_cents is null or price_unit is not null)
);

comment on table public.request_proposals is
  'A Pro vendor''s answer to a request: price, note, a menu or reel. The family accepts (opening the chat) or declines.';

create index request_proposals_vendor_idx on public.request_proposals (vendor_id, created_at desc);

alter table public.request_proposals enable row level security;

create policy "The family and the vendor see their proposals" on public.request_proposals
  for select to authenticated
  using (
    (select private.is_vendor_member(vendor_id))
    or exists (
      select 1 from public.wedding_requests r
      join public.wedding_members m on m.wedding_id = r.wedding_id
      where r.id = request_proposals.request_id and m.user_id = (select auth.uid())
    )
  );

revoke all on public.request_proposals from anon, authenticated;
grant select on public.request_proposals to authenticated;

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'photo', 'quote', 'menu', 'booking', 'phone', 'voice', 'deposit', 'proposal'));

-- Families post and close -----------------------------------------------------------------

create function private.post_request(
  p_wedding_id uuid,
  p_category_slug text,
  p_note text,
  p_city_slug text,
  p_event_slug text default null,
  p_event_date date default null,
  p_guest_band text default null,
  p_budget_min_cents integer default null,
  p_budget_max_cents integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_id uuid;
begin
  if caller is null or not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.categories where slug = p_category_slug) then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  if p_event_slug is not null and not exists (select 1 from public.events where slug = p_event_slug) then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  if not exists (select 1 from public.cities where slug = p_city_slug) then
    raise exception 'invalid_city' using errcode = '22023';
  end if;
  if p_event_date is not null and p_event_date < (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'date_passed' using errcode = '22023';
  end if;
  p_note := nullif(btrim(p_note), '');
  if p_note is null or length(p_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if p_budget_min_cents is not null and p_budget_max_cents is not null
    and p_budget_min_cents > p_budget_max_cents then
    raise exception 'invalid_budget' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.wedding_requests
    where wedding_id = p_wedding_id and status = 'open' and expires_at > now()
      and category_slug = p_category_slug and event_slug is not distinct from p_event_slug
  ) then
    raise exception 'already_open' using errcode = '23505';
  end if;
  if (select count(*) from public.wedding_requests
      where wedding_id = p_wedding_id and status = 'open' and expires_at > now()) >= 10 then
    raise exception 'too_many_open' using errcode = 'P0001';
  end if;
  if (select count(*) from public.wedding_requests
      where created_by = caller and created_at > now() - interval '1 day') >= 5 then
    raise exception 'request_rate' using errcode = 'P0001';
  end if;

  insert into public.wedding_requests (
    wedding_id, created_by, category_slug, event_slug, event_date, guest_band,
    budget_min_cents, budget_max_cents, note, city_slug, expires_at
  )
  values (
    p_wedding_id, caller, p_category_slug, p_event_slug, p_event_date, p_guest_band,
    p_budget_min_cents, p_budget_max_cents, p_note, p_city_slug,
    case
      when p_event_date is not null then (p_event_date + 1)::timestamp at time zone 'America/Los_Angeles'
      else now() + interval '90 days'
    end
  )
  returning id into new_id;
  return new_id;
end;
$$;

create function public.post_request(
  p_wedding_id uuid,
  p_category_slug text,
  p_note text,
  p_city_slug text,
  p_event_slug text default null,
  p_event_date date default null,
  p_guest_band text default null,
  p_budget_min_cents integer default null,
  p_budget_max_cents integer default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.post_request(p_wedding_id, p_category_slug, p_note, p_city_slug, p_event_slug,
    p_event_date, p_guest_band, p_budget_min_cents, p_budget_max_cents);
$$;

comment on function public.post_request is
  'Post what the family is looking for to Pro vendors (owner or editor of the wedding). One open request per vendor type and event, 10 open per wedding, 5 a day. Errors: not_allowed, invalid_category, invalid_event, invalid_city, date_passed, invalid_note, invalid_budget, already_open, too_many_open, request_rate.';

create function private.close_request(p_request_id uuid, p_booked boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.wedding_requests;
begin
  select * into r from public.wedding_requests where id = p_request_id;
  if r.id is null or not private.can_edit_wedding(r.wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.wedding_requests
  set status = case when p_booked then 'booked' else 'closed' end,
      closed_at = now(), updated_at = now()
  where id = r.id and status = 'open';
end;
$$;

create function public.close_request(p_request_id uuid, p_booked boolean default false)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.close_request(p_request_id, p_booked);
$$;

comment on function public.close_request is
  'Stop a request taking proposals: booked (they found someone) or closed. Errors: not_allowed.';

-- Families looking (vendors) ---------------------------------------------------------------

-- Open requests that fit a vendor: one of their vendor types, near enough,
-- not expired, nobody blocked either way.
create function private.fitting_requests(p_vendor_id uuid, p_max_miles integer)
returns table (request_id uuid, miles numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
    round((extensions.st_distance(v.location, c.location) / 1609.344)::numeric, 1)
  from public.vendors v
  join public.wedding_requests r on r.status = 'open' and r.expires_at > now()
  join public.cities c on c.slug = r.city_slug
  where v.id = p_vendor_id
    and r.category_slug in (select vc.category_slug from public.vendor_categories vc where vc.vendor_id = v.id)
    and extensions.st_dwithin(
      v.location, c.location,
      greatest(coalesce(p_max_miles, 50), coalesce(v.service_radius_miles, 0)) * 1609.344
    )
    and not exists (
      select 1 from public.vendor_members vm
      where vm.vendor_id = v.id and private.blocked_between(vm.user_id, r.created_by)
    );
$$;

create function private.families_looking(
  p_vendor_id uuid,
  p_category_slug text default null,
  p_max_miles integer default 50,
  p_from date default null,
  p_to date default null,
  p_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  family_name text,
  city text,
  category_slug text,
  category_name jsonb,
  event_slug text,
  event_name jsonb,
  event_date date,
  guest_band text,
  budget_min_cents integer,
  budget_max_cents integer,
  note text,
  miles numeric,
  proposal_count integer,
  proposals_full boolean,
  already_proposed boolean,
  date_status text,
  created_at timestamptz
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
    case when r.event_date is null then 'unknown' else private.vendor_date_status(p_vendor_id, r.event_date) end,
    r.created_at
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
$$;

create function public.families_looking(
  p_vendor_id uuid,
  p_category_slug text default null,
  p_max_miles integer default 50,
  p_from date default null,
  p_to date default null,
  p_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  family_name text,
  city text,
  category_slug text,
  category_name jsonb,
  event_slug text,
  event_name jsonb,
  event_date date,
  guest_band text,
  budget_min_cents integer,
  budget_max_cents integer,
  note text,
  miles numeric,
  proposal_count integer,
  proposals_full boolean,
  already_proposed boolean,
  date_status text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.families_looking(p_vendor_id, p_category_slug, p_max_miles, p_from, p_to,
    p_before, p_limit);
$$;

comment on function public.families_looking is
  'Wedded Pro: open requests that fit this vendor (their vendor types, within p_max_miles or their own travel area), newest first, with the short family name and town only. Errors: not_allowed, pro_only.';

-- The teaser: how many fit, by vendor type, for any of the vendor's people
create function private.families_looking_summary(p_vendor_id uuid)
returns table (category_slug text, category_name jsonb, open_requests integer)
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
  select r.category_slug, cat.name, count(*)::integer
  from private.fitting_requests(p_vendor_id, 50) f
  join public.wedding_requests r on r.id = f.request_id
  join public.categories cat on cat.slug = r.category_slug
  group by r.category_slug, cat.name
  order by count(*) desc;
end;
$$;

create function public.families_looking_summary(p_vendor_id uuid)
returns table (category_slug text, category_name jsonb, open_requests integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.families_looking_summary(p_vendor_id);
$$;

comment on function public.families_looking_summary is
  'How many open requests near a vendor fit their vendor types (the free teaser). Errors: not_allowed.';

-- Proposals --------------------------------------------------------------------------------

create function private.send_proposal(
  p_request_id uuid,
  p_vendor_id uuid,
  p_note text,
  p_price_cents integer default null,
  p_price_unit text default null,
  p_menu_id uuid default null,
  p_reel_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  r public.wedding_requests;
  new_id uuid;
begin
  if caller is null or not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_pro(p_vendor_id) then
    raise exception 'pro_only' using errcode = '42501';
  end if;
  select * into r from public.wedding_requests where id = p_request_id for update;
  if r.id is null or not exists (
    select 1 from private.fitting_requests(p_vendor_id, 250) f where f.request_id = r.id
  ) then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.request_proposals where request_id = r.id and vendor_id = p_vendor_id) then
    raise exception 'already_sent' using errcode = '23505';
  end if;
  if r.proposal_count >= 10 then
    raise exception 'proposals_full' using errcode = 'P0001';
  end if;
  if (select count(*) from public.request_proposals
      where vendor_id = p_vendor_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'proposal_rate' using errcode = 'P0001';
  end if;
  p_note := nullif(btrim(p_note), '');
  if p_note is null or length(p_note) > 600 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if (p_price_cents is null) <> (p_price_unit is null)
    or (p_price_cents is not null and p_price_cents not between 100 and 100000000)
    or (p_price_unit is not null and p_price_unit not in ('event', 'hour', 'person', 'plate', 'day')) then
    raise exception 'invalid_price' using errcode = '22023';
  end if;
  if p_menu_id is not null and not exists (
    select 1 from public.vendor_menus where id = p_menu_id and vendor_id = p_vendor_id
  ) then
    raise exception 'invalid_menu' using errcode = '22023';
  end if;
  if p_reel_id is not null and not exists (
    select 1 from public.reels rl
    where rl.id = p_reel_id and rl.status = 'live'
      and (rl.vendor_id = p_vendor_id or exists (
        select 1 from public.reel_vendor_tags t
        where t.reel_id = rl.id and t.vendor_id = p_vendor_id and t.status = 'approved'))
  ) then
    raise exception 'invalid_reel' using errcode = '22023';
  end if;

  insert into public.request_proposals (request_id, vendor_id, sent_by, price_cents, price_unit, note, menu_id, reel_id)
  values (r.id, p_vendor_id, caller, p_price_cents, p_price_unit, p_note, p_menu_id, p_reel_id)
  returning id into new_id;
  update public.wedding_requests
  set proposal_count = proposal_count + 1, updated_at = now()
  where id = r.id;
  return new_id;
end;
$$;

create function public.send_proposal(
  p_request_id uuid,
  p_vendor_id uuid,
  p_note text,
  p_price_cents integer default null,
  p_price_unit text default null,
  p_menu_id uuid default null,
  p_reel_id uuid default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.send_proposal(p_request_id, p_vendor_id, p_note, p_price_cents, p_price_unit,
    p_menu_id, p_reel_id);
$$;

comment on function public.send_proposal is
  'Wedded Pro: answer an open request that fits you, once (price and unit together, a note, optionally your menu or a reel you''re in). At most 10 proposals per request and 30 a day. Errors: not_allowed, pro_only, not_open, already_sent, proposals_full, proposal_rate, invalid_note, invalid_price, invalid_menu, invalid_reel.';

create function private.withdraw_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rp public.request_proposals;
begin
  select * into rp from public.request_proposals where id = p_proposal_id;
  if rp.id is null or not private.is_vendor_member(rp.vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if rp.status <> 'sent' then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  update public.request_proposals set status = 'withdrawn', answered_at = now() where id = rp.id;
end;
$$;

create function public.withdraw_proposal(p_proposal_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.withdraw_proposal(p_proposal_id);
$$;

comment on function public.withdraw_proposal is
  'Take back a proposal the family hasn''t answered (it still counts toward the request''s 10). Errors: not_allowed, already_answered.';

-- The family accepts (opening the chat with the proposal in it) or declines.
-- Returns the conversation on accept.
create function private.answer_proposal(p_proposal_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  rp public.request_proposals;
  r public.wedding_requests;
  convo uuid;
begin
  select * into rp from public.request_proposals where id = p_proposal_id for update;
  select * into r from public.wedding_requests where id = rp.request_id;
  if rp.id is null or caller is null or not private.can_edit_wedding(r.wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if rp.status <> 'sent' then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.request_proposals set status = 'declined', answered_at = now() where id = rp.id;
    return null;
  end if;

  -- The family's chat with this vendor (one per family and vendor)
  select id into convo from public.conversations
  where vendor_id = rp.vendor_id and family_user_id = caller;
  if convo is null then
    insert into public.conversations (vendor_id, family_user_id, family_name)
    values (rp.vendor_id, caller,
      (select private.short_name(full_name) from public.profiles where id = caller))
    returning id into convo;
  end if;

  -- The proposal as the vendor sent it, then the family's yes: the family has
  -- now written, so the vendor can reply under the usual chat rules
  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, created_at)
  values
    (convo, rp.sent_by, 'vendor', 'proposal', rp.note,
      jsonb_build_object('proposalId', rp.id, 'requestId', r.id), clock_timestamp()),
    (convo, caller, 'family', 'proposal', null,
      jsonb_build_object('proposalId', rp.id, 'requestId', r.id, 'update', 'accepted'),
      clock_timestamp() + interval '1 millisecond');
  update public.conversations
  set last_message_at = clock_timestamp(), family_read_at = clock_timestamp()
  where id = convo;

  update public.request_proposals
  set status = 'accepted', answered_at = now(), conversation_id = convo
  where id = rp.id;
  return convo;
end;
$$;

create function public.answer_proposal(p_proposal_id uuid, p_accept boolean)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.answer_proposal(p_proposal_id, p_accept);
$$;

comment on function public.answer_proposal is
  'The family accepts a proposal (returns the chat it opened, with the proposal in it) or declines it. Owners and editors of the wedding. Errors: not_allowed, already_answered.';

-- What the family sees about each proposal's vendor
create function private.request_proposals_for(p_request_id uuid)
returns table (
  id uuid,
  vendor_id uuid,
  vendor_slug text,
  vendor_name text,
  vendor_name_pa text,
  vendor_city text,
  cover_path text,
  founding_number integer,
  price_cents integer,
  price_unit text,
  note text,
  menu_id uuid,
  reel_id uuid,
  status text,
  conversation_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.wedding_requests;
begin
  select * into r from public.wedding_requests where id = p_request_id;
  if r.id is null or not exists (
    select 1 from public.wedding_members m where m.wedding_id = r.wedding_id and m.user_id = (select auth.uid())
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select rp.id, v.id, v.slug, v.name, v.name_pa, v.city,
    (select vm.storage_path from public.vendor_media vm
     where vm.vendor_id = v.id order by vm.is_cover desc, vm.sort_order limit 1),
    v.founding_number, rp.price_cents, rp.price_unit, rp.note, rp.menu_id, rp.reel_id,
    rp.status, rp.conversation_id, rp.created_at
  from public.request_proposals rp
  join public.vendors v on v.id = rp.vendor_id
  where rp.request_id = r.id and rp.status <> 'withdrawn'
  order by (rp.status = 'accepted') desc, rp.created_at;
end;
$$;

create function public.request_proposals_for(p_request_id uuid)
returns table (
  id uuid,
  vendor_id uuid,
  vendor_slug text,
  vendor_name text,
  vendor_name_pa text,
  vendor_city text,
  cover_path text,
  founding_number integer,
  price_cents integer,
  price_unit text,
  note text,
  menu_id uuid,
  reel_id uuid,
  status text,
  conversation_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.request_proposals_for(p_request_id);
$$;

comment on function public.request_proposals_for is
  'The proposals on a request, for its wedding''s members: the vendor (name, town, cover photo, founding number), price, note, menu or reel, and status. Errors: not_allowed.';

revoke all on function
  private.is_pro, private.fitting_requests,
  private.post_request, public.post_request, private.close_request, public.close_request,
  private.families_looking, public.families_looking,
  private.families_looking_summary, public.families_looking_summary,
  private.send_proposal, public.send_proposal, private.withdraw_proposal, public.withdraw_proposal,
  private.answer_proposal, public.answer_proposal,
  private.request_proposals_for, public.request_proposals_for
from public;
grant execute on function
  private.post_request, public.post_request, private.close_request, public.close_request,
  private.families_looking, public.families_looking,
  private.families_looking_summary, public.families_looking_summary,
  private.send_proposal, public.send_proposal, private.withdraw_proposal, public.withdraw_proposal,
  private.answer_proposal, public.answer_proposal,
  private.request_proposals_for, public.request_proposals_for
to authenticated;
