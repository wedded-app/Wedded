-- Hall facts, to the database design (venue_policies, venue_rooms): the
-- answers to a hall's daily phone calls become columns families can filter
-- on, and its capacity lives with its rooms. For vendors in a venue category
-- they come out of vendors.details,
-- which keeps the facts particular to other vendor types (a DJ's genres, how
-- many dholis come) and the few hall facts the design has no column for
-- (a bridal suite).
--
-- Every policy answer is null until the hall says: an unknown is not a no.
-- A room's floor plan joins it once there's a table for uploaded files.

create table public.venue_policies (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  in_house_catering text check (in_house_catering in ('yes', 'no', 'optional')),
  outside_catering text check (outside_catering in ('yes', 'approved_list', 'no')),
  alcohol_policy text check (alcohol_policy in ('full_bar', 'beer_wine', 'byob', 'dry')),
  corkage_cents integer check (corkage_cents >= 0),
  bartender_required boolean,
  security_rule text check (length(btrim(security_rule)) between 1 and 200),
  ghori_allowed boolean,
  dhol_outside_allowed boolean,
  cold_sparks_allowed boolean,
  music_curfew time,
  same_day_two_events boolean,
  min_guests integer check (min_guests > 0),
  per_plate_min_cents integer check (per_plate_min_cents > 0),
  rental_fees jsonb check (jsonb_typeof(rental_fees) = 'object'),
  deposit_percent smallint check (deposit_percent between 0 and 100),
  parking_spaces integer check (parking_spaces > 0),
  tour_booking text check (tour_booking in ('walk_in', 'appointment')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venue_policies is
  'The answers to a hall''s daily phone calls, as searchable columns: can we bring our own caterer, alcohol, ghori, dhol outside, cold sparks, curfew, minimums, fees, parking, how to tour. Null until the hall says.';
comment on column public.venue_policies.rental_fees is 'Rent by day: {"mon_thu": 150000, "fri": 300000, "sat": 450000, "sun": 350000} in cents.';

create table public.venue_rooms (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  seated integer check (seated > 0),
  standing integer check (standing > 0),
  ceiling_ft smallint check (ceiling_ft > 0),
  combines_with_id uuid references public.venue_rooms (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_rooms_one_name unique (vendor_id, name),
  constraint venue_rooms_not_combined_with_self check (combines_with_id <> id)
);

comment on table public.venue_rooms is
  'Rooms inside a hall: seated, standing, ceiling height, and the room it opens into. A hall''s capacity is its biggest room.';

create index venue_rooms_vendor_id_idx on public.venue_rooms (vendor_id);
create index venue_rooms_combines_with_id_idx on public.venue_rooms (combines_with_id);

create trigger set_updated_at before update on public.venue_policies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.venue_rooms
  for each row execute function private.set_updated_at();

-- Out of details ------------------------------------------------------------------------------

-- A hall's facts as the founders write them (the keys of their vendor file's
-- details: seated_capacity, in_house_catering, outside_catering,
-- alcohol_policy, corkage in whole dollars, security_required, ghori_allowed,
-- dhol_outside_allowed, curfew "01:00", min_headcount, parking_spaces) into
-- venue_policies and the hall's main room. A key left out keeps its value;
-- null clears it. Used by this migration, seed.sql and npm run vendors:import.
create function private.set_hall_facts(p_vendor_id uuid, p_facts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb := coalesce(p_facts, '{}'::jsonb);
begin
  insert into public.venue_policies (vendor_id) values (p_vendor_id) on conflict do nothing;
  update public.venue_policies p set
    in_house_catering = case when f ? 'in_house_catering' then f ->> 'in_house_catering' else p.in_house_catering end,
    outside_catering = case when f ? 'outside_catering' then f ->> 'outside_catering' else p.outside_catering end,
    alcohol_policy = case when f ? 'alcohol_policy'
      then case f ->> 'alcohol_policy' when 'none' then 'dry' else f ->> 'alcohol_policy' end
      else p.alcohol_policy end,
    corkage_cents = case when f ? 'corkage'
      then round((f ->> 'corkage')::numeric * 100)::integer else p.corkage_cents end,
    security_rule = case when f ? 'security_required'
      then case when f -> 'security_required' = 'true'::jsonb then 'Security guards required' end
      else p.security_rule end,
    ghori_allowed = case when f ? 'ghori_allowed' then (f ->> 'ghori_allowed')::boolean else p.ghori_allowed end,
    dhol_outside_allowed = case when f ? 'dhol_outside_allowed'
      then (f ->> 'dhol_outside_allowed')::boolean else p.dhol_outside_allowed end,
    music_curfew = case when f ? 'curfew' then (f ->> 'curfew')::time else p.music_curfew end,
    min_guests = case when f ? 'min_headcount' then (f ->> 'min_headcount')::numeric::integer else p.min_guests end,
    parking_spaces = case when f ? 'parking_spaces'
      then (f ->> 'parking_spaces')::numeric::integer else p.parking_spaces end
  where p.vendor_id = p_vendor_id;

  if f ? 'seated_capacity' then
    insert into public.venue_rooms (vendor_id, name, seated)
    values (p_vendor_id, 'Main hall', (f ->> 'seated_capacity')::numeric::integer)
    on conflict (vendor_id, name) do update set seated = excluded.seated;
  end if;
end;
$$;

create function public.set_hall_facts(p_vendor_id uuid, p_facts jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_hall_facts(p_vendor_id, p_facts);
$$;

comment on function public.set_hall_facts is
  'Founders'' import only (service role): a hall''s facts from their vendor file into venue_policies and its main room.';

revoke all on function private.set_hall_facts, public.set_hall_facts from public, anon, authenticated;
grant execute on function private.set_hall_facts, public.set_hall_facts to service_role;

-- The hall-fact keys move out of details, for vendors in a venue category
select private.set_hall_facts(v.id, v.details)
from public.vendors v
where exists (
    select 1 from public.vendor_categories vc join public.categories c on c.slug = vc.category_slug
    where vc.vendor_id = v.id and c.group_slug = 'venues')
  and v.details ?| array['seated_capacity', 'in_house_catering', 'outside_catering', 'alcohol_policy',
    'corkage', 'security_required', 'ghori_allowed', 'dhol_outside_allowed', 'curfew', 'min_headcount',
    'parking_spaces'];

update public.vendors v
set details = details - array['seated_capacity', 'in_house_catering', 'outside_catering', 'alcohol_policy',
  'corkage', 'security_required', 'ghori_allowed', 'dhol_outside_allowed', 'curfew', 'min_headcount',
  'parking_spaces']
where exists (
    select 1 from public.vendor_categories vc join public.categories c on c.slug = vc.category_slug
    where vc.vendor_id = v.id and c.group_slug = 'venues')
  and details ?| array['seated_capacity', 'in_house_catering', 'outside_catering', 'alcohol_policy',
    'corkage', 'security_required', 'ghori_allowed', 'dhol_outside_allowed', 'curfew', 'min_headcount',
    'parking_spaces'];

comment on column public.vendors.details is
  'Facts particular to the vendor''s type that have no table of their own: a DJ''s genres, how many dholis come, a bridal suite.';

-- Readable with the vendor, written by the founders ------------------------------------------

alter table public.venue_policies enable row level security;
alter table public.venue_rooms enable row level security;
create policy "Readable with the vendor" on public.venue_policies
  for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id));
create policy "Readable with the vendor" on public.venue_rooms
  for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id));
revoke all on public.venue_policies, public.venue_rooms from anon, authenticated;
grant select on public.venue_policies, public.venue_rooms to anon, authenticated;

-- Search filters halls by their biggest room
CREATE OR REPLACE FUNCTION public.search_vendors(lat double precision DEFAULT NULL::double precision, lng double precision DEFAULT NULL::double precision, max_miles integer DEFAULT 25, category_slug text DEFAULT NULL::text, event_slug text DEFAULT NULL::text, query text DEFAULT NULL::text, include_travelers boolean DEFAULT false, result_limit integer DEFAULT 50, result_offset integer DEFAULT 0, min_guests integer DEFAULT NULL::integer, max_price_cents integer DEFAULT NULL::integer, language text DEFAULT NULL::text, sort text DEFAULT 'distance'::text, available_on date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, slug text, name text, city text, primary_category_slug text, primary_category_name jsonb, price_display text, price_from_cents integer, price_to_cents integer, price_unit text, founding_number smallint, distance_miles double precision, within_search_radius boolean, latitude double precision, longitude double precision, cover_path text, is_sample boolean)
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
      -- Venues whose biggest room seats at least this many (vendors without
      -- a capacity, like a DJ, aren't filtered out)
      and (search_vendors.min_guests is null
        or not exists (select 1 from public.venue_rooms r where r.vendor_id = v.id and r.seated is not null)
        or (select max(r.seated) from public.venue_rooms r where r.vendor_id = v.id) >= search_vendors.min_guests)
      -- A shown starting price at or under this (vendors who don't show a
      -- price stay in: "Contact for price")
      and (search_vendors.max_price_cents is null
        or v.price_display not in ('starting_at', 'range')
        or v.price_from_cents is null
        or v.price_from_cents <= search_vendors.max_price_cents)
      and (search_vendors.language is null or exists (
        select 1 from public.vendor_languages vl
        where vl.vendor_id = v.id and vl.language_code = search_vendors.language
      ))
      -- Not booked all day on the family's date (held or partly booked stays in)
      and (search_vendors.available_on is null or not exists (
        select 1 from public.vendor_days u
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
    (select ci.name from public.cities ci where ci.slug = m.base_city_slug),
    pc.category_slug,
    c.name,
    m.price_display,
    m.price_from_cents,
    m.price_to_cents,
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
      then m.price_from_cents end nulls last,
    case when search_vendors.sort = 'founding' then m.founding_number end nulls last,
    m.miles nulls last, m.founding_number nulls last, (cover.storage_path is null), m.name
  limit least(greatest(search_vendors.result_limit, 1), 100)
  offset greatest(search_vendors.result_offset, 0);
$function$;
