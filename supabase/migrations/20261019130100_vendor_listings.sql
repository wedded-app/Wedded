-- Vendor listings, to the database design (Vendor listings): the record
-- itself, its contacts and languages as rows, its city as a link, money in
-- cents, where the listing came from, the calendar and the links between
-- vendors.
--
-- languages         Languages vendors speak (pa, hi, ur, ar, en).
-- vendor_languages  Which ones each vendor speaks (was vendors.languages).
-- vendor_contacts   Call, text, WhatsApp, Instagram and website, one row
--                   each, one of them preferred (were columns on vendors).
-- vendors           city (a name) becomes base_city_slug; address_line is
--                   public_address; travel_note is travel_fee_note; prices
--                   are cents; source is provenance; published_at and
--                   merged_into_id are new; status can be in_review or slow.
-- vendor_private    notes is founder_notes; checks_email is always set.
-- vendor_days       Was vendor_unavailable_days: open, held or booked by day
--                   and part of day, with capacity, where it came from and
--                   the booking behind it.
-- vendor_links      From one vendor to another (a hall to a caterer), each
--                   side's confirmation as a time, and the hall can hide one.
--
-- The listing editor (my_listing, update_my_listing) keeps its keys, so the
-- app's form is unchanged: it still speaks whole dollars, stored as cents.

-- Languages -----------------------------------------------------------------------------

create table public.languages (
  code text primary key check (code ~ '^[a-z]{2}$'),
  name jsonb not null check (private.is_localized_text(name)),
  sort_order smallint not null unique,
  created_at timestamptz not null default now()
);

comment on table public.languages is 'Languages vendors speak and MCs perform in.';

insert into public.languages (code, name, sort_order) values
  ('pa', '{"en": "Punjabi"}', 1),
  ('hi', '{"en": "Hindi"}', 2),
  ('ur', '{"en": "Urdu"}', 3),
  ('en', '{"en": "English"}', 4),
  ('ar', '{"en": "Arabic"}', 5);

alter table public.languages enable row level security;
create policy "Languages are readable by everyone" on public.languages
  for select to anon, authenticated using (true);
revoke all on public.languages from anon, authenticated;
grant select on public.languages to anon, authenticated;

create table public.vendor_languages (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  language_code text not null references public.languages (code) on update cascade,
  created_at timestamptz not null default now(),
  primary key (vendor_id, language_code)
);

comment on table public.vendor_languages is 'Languages a vendor speaks: Speaks Punjabi, Hindi, English.';

create index vendor_languages_language_code_idx on public.vendor_languages (language_code);

insert into public.vendor_languages (vendor_id, language_code)
select distinct v.id, l.code
from public.vendors v
cross join lateral unnest(v.languages) as l (code)
where exists (select 1 from public.languages x where x.code = l.code);

-- Contacts ------------------------------------------------------------------------------

create table public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind text not null check (kind in ('call', 'text', 'whatsapp', 'email', 'instagram', 'tiktok', 'facebook', 'website')),
  value text not null,
  is_preferred boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- shortcut: one of each kind, which is what the listing editor and page show; drop it when a hall lists two office numbers
  constraint vendor_contacts_one_per_kind unique (vendor_id, kind),
  constraint vendor_contacts_value_check check (case kind
    when 'call' then value ~ '^\+1[2-9][0-9]{9}$'
    when 'text' then value ~ '^\+1[2-9][0-9]{9}$'
    when 'whatsapp' then value ~ '^\+[1-9][0-9]{7,14}$'
    when 'email' then value ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    when 'instagram' then value ~ '^[A-Za-z0-9._]{1,30}$'
    when 'tiktok' then value ~ '^[A-Za-z0-9._]{2,24}$'
    else value ~ '^https?://[^\s]+$'
  end)
);

comment on table public.vendor_contacts is
  'Call, text and WhatsApp numbers (often different), Instagram, TikTok, Facebook and website, printed on the page so elders can read them aloud. Phones are E.164; Instagram and TikTok are handles without the @.';

create unique index vendor_contacts_one_preferred on public.vendor_contacts (vendor_id) where is_preferred;

insert into public.vendor_contacts (vendor_id, kind, value, is_preferred, sort_order)
select v.id, c.kind, c.value, v.preferred_contact = c.kind, c.sort_order
from public.vendors v
cross join lateral (values
  ('call', v.call_phone, 1),
  ('text', v.text_phone, 2),
  ('whatsapp', v.whatsapp_phone, 3),
  ('instagram', v.instagram_handle, 5),
  ('website', v.website_url, 8)
) as c (kind, value, sort_order)
where c.value is not null;

create trigger set_updated_at before update on public.vendor_contacts
  for each row execute function private.set_updated_at();

-- What a vendor's page shows comes with the vendor: published, or the
-- vendor's own people (the vendors table's policies decide)
alter table public.vendor_languages enable row level security;
alter table public.vendor_contacts enable row level security;
create policy "Readable with the vendor" on public.vendor_languages
  for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id));
create policy "Readable with the vendor" on public.vendor_contacts
  for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id));
revoke all on public.vendor_languages, public.vendor_contacts from anon, authenticated;
grant select on public.vendor_languages, public.vendor_contacts to anon, authenticated;

alter table public.vendors
  drop column call_phone,
  drop column text_phone,
  drop column whatsapp_phone,
  drop column instagram_handle,
  drop column website_url,
  drop column preferred_contact,
  drop column languages;

-- The base city is a city ------------------------------------------------------------------

alter table public.vendors add column base_city_slug text references public.cities (slug) on update cascade;

-- By name, then nickname, then the nearest listed city to their point
update public.vendors v set base_city_slug = c.slug
from public.cities c
where lower(c.name) = lower(btrim(v.city));
update public.vendors v set base_city_slug = c.slug
from public.cities c
where v.base_city_slug is null and lower(btrim(v.city)) = any (c.nicknames);
update public.vendors v set base_city_slug = (
  select c.slug from public.cities c
  order by extensions.st_distance(c.location, v.location)
  limit 1
)
where v.base_city_slug is null;

alter table public.vendors
  alter column base_city_slug set not null,
  drop column city;
create index vendors_base_city_slug_idx on public.vendors (base_city_slug);

comment on column public.vendors.base_city_slug is
  'The city they work from; their public point is that city''s centre when they''re home-based.';

-- The rest of the record ------------------------------------------------------------------

alter table public.vendors rename column address_line to public_address;
alter table public.vendors rename column travel_note to travel_fee_note;
alter table public.vendors rename column price_from to price_from_cents;
alter table public.vendors rename column price_to to price_to_cents;
update public.vendors set price_from_cents = price_from_cents * 100, price_to_cents = price_to_cents * 100;

comment on column public.vendors.public_address is 'Filled only when address_visibility is public.';
comment on column public.vendors.will_travel is
  'Goes farther than service_radius_miles, for a fee (travel_fee_note says what).';
comment on column public.vendors.price_from_cents is 'US cents, like every amount.';

alter table public.vendors add column provenance text not null default 'founder_entered'
  check (provenance in ('founder_entered', 'claimed', 'self_signup', 'ai_intake'));
update public.vendors set provenance = case source
  when 'founder' then 'founder_entered' when 'claimed' then 'claimed' else 'self_signup' end;
alter table public.vendors drop column source;

comment on column public.vendors.provenance is
  'Where the listing came from: entered by the founders, claimed by the business, a self sign-up, or AI intake.';

alter table public.vendors drop constraint vendors_status_check;
alter table public.vendors add constraint vendors_status_check
  check (status in ('draft', 'in_review', 'published', 'slow', 'hidden', 'retired'));

comment on column public.vendors.status is
  'draft, in_review, published, slow (slow to respond, still listed), hidden (silent 90 days) or retired.';

alter table public.vendors
  add column published_at timestamptz,
  add column merged_into_id uuid references public.vendors (id) on delete set null;
alter table public.vendors add constraint vendors_not_merged_into_self check (merged_into_id <> id);
update public.vendors set published_at = created_at where status = 'published';
create index vendors_merged_into_id_idx on public.vendors (merged_into_id);

comment on column public.vendors.merged_into_id is 'A duplicate points to the listing that stays.';

create function private.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger stamp_published_at before insert or update of status on public.vendors
  for each row execute function private.stamp_published_at();

-- Constraint names follow the columns
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.vendors'::regclass
      and (conname like '%address_line%' or conname like '%travel_note%'
        or conname like 'vendors_price_from_check' or conname like 'vendors_price_to_check')
  loop
    execute format('alter table public.vendors rename constraint %I to %I', r.conname,
      replace(replace(replace(replace(r.conname,
        'address_line', 'public_address'), 'travel_note', 'travel_fee_note'),
        'price_from_check', 'price_from_cents_check'), 'price_to_check', 'price_to_cents_check'));
  end loop;
end;
$$;

-- What families never see --------------------------------------------------------------

alter table public.vendor_private rename column notes to founder_notes;
update public.vendor_private set checks_email = false where checks_email is null;
alter table public.vendor_private
  alter column checks_email set default false,
  alter column checks_email set not null;

-- The calendar ------------------------------------------------------------------------------

alter table public.vendor_unavailable_days rename to vendor_days;
alter table public.vendor_days drop constraint vendor_unavailable_days_status_check;
alter table public.vendor_days
  add constraint vendor_days_status_check check (status in ('open', 'held', 'booked')),
  add column capacity smallint check (capacity between 1 and 20),
  add column taken smallint check (taken >= 0),
  add column source text not null default 'vendor'
    check (source in ('vendor', 'founder_whatsapp', 'office', 'google_sync', 'ical', 'booking')),
  add column booking_id uuid references public.bookings (id) on delete set null,
  add constraint vendor_days_taken_within_capacity check (taken <= capacity);

comment on table public.vendor_days is
  'Open, held or booked, by day and part of day. Families see free or not, never whose wedding. capacity is for vendors who take several a day (DJs, mehndi artists).';

create index vendor_days_booking_id_idx on public.vendor_days (booking_id);

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.vendor_days'::regclass and conname like 'vendor_unavailable_days%'
  loop
    execute format('alter table public.vendor_days rename constraint %I to %I', r.conname,
      replace(r.conname, 'vendor_unavailable_days', 'vendor_days'));
  end loop;
  for r in
    select i.relname from pg_class i join pg_index x on x.indexrelid = i.oid
    where x.indrelid = 'public.vendor_days'::regclass and i.relname like 'vendor_unavailable_days%'
  loop
    execute format('alter index public.%I rename to %I', r.relname,
      replace(r.relname, 'vendor_unavailable_days', 'vendor_days'));
  end loop;
end;
$$;

-- Links between vendors -----------------------------------------------------------------

drop policy "Confirmed links between published vendors are readable by every" on public.vendor_links;

alter table public.vendor_links rename column venue_vendor_id to from_vendor_id;
alter table public.vendor_links rename column vendor_id to to_vendor_id;
alter table public.vendor_links
  add column from_confirmed_at timestamptz,
  add column to_confirmed_at timestamptz,
  add column hidden_by_venue boolean not null default false;
update public.vendor_links set
  from_confirmed_at = case when confirmed_by_venue then updated_at end,
  to_confirmed_at = case when confirmed_by_vendor then updated_at end;
alter table public.vendor_links drop constraint vendor_links_kind_check;
update public.vendor_links set kind = case kind when 'approved_at' then 'approved_caterer' else 'worked_at' end;
alter table public.vendor_links
  drop column confirmed_by_both,
  drop column confirmed_by_venue,
  drop column confirmed_by_vendor,
  add constraint vendor_links_kind_check
    check (kind in ('approved_caterer', 'worked_at', 'often_works_with', 'partner'));

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.vendor_links'::regclass
      and (conname like '%venue_vendor_id%' or conname like 'vendor_links_vendor_id%')
  loop
    execute format('alter table public.vendor_links rename constraint %I to %I', r.conname,
      replace(replace(r.conname, 'venue_vendor_id', 'from_vendor_id'), 'vendor_links_vendor_id', 'vendor_links_to_vendor_id'));
  end loop;
  for r in
    select i.relname from pg_class i join pg_index x on x.indexrelid = i.oid
    where x.indrelid = 'public.vendor_links'::regclass
      and (i.relname like '%venue_vendor_id%' or i.relname like 'vendor_links_vendor_id%')
  loop
    execute format('alter index public.%I rename to %I', r.relname,
      replace(replace(r.relname, 'venue_vendor_id', 'from_vendor_id'), 'vendor_links_vendor_id', 'vendor_links_to_vendor_id'));
  end loop;
end;
$$;

comment on table public.vendor_links is
  'Approved caterers, worked at this venue, often works with, partner dholi. From the venue (or the first vendor) to the other; public once both sides confirm, unless the venue hides it.';

create policy "Confirmed links between published vendors are public" on public.vendor_links
  for select to anon, authenticated
  using (
    from_confirmed_at is not null and to_confirmed_at is not null and not hidden_by_venue
    and exists (select 1 from public.vendors v where v.id = from_vendor_id and v.status = 'published')
    and exists (select 1 from public.vendors v where v.id = to_vendor_id and v.status = 'published')
  );

-- The listing editor ---------------------------------------------------------------------------

create or replace function private.my_listing(p_vendor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vendors;
  contact jsonb;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v from public.vendors where id = p_vendor_id;
  select coalesce(jsonb_object_agg(c.kind, c.value), '{}'::jsonb)
    || coalesce(jsonb_build_object('preferred', max(c.kind) filter (where c.is_preferred)), '{}'::jsonb)
  into contact
  from public.vendor_contacts c where c.vendor_id = p_vendor_id;
  return jsonb_build_object(
    'name', v.name,
    'slug', v.slug,
    'status', v.status,
    'city', (select c.name from public.cities c where c.slug = v.base_city_slug),
    'tagline', v.tagline,
    'bio', v.bio,
    'priceDisplay', v.price_display,
    -- The editor speaks whole dollars
    'priceFrom', v.price_from_cents / 100,
    'priceTo', v.price_to_cents / 100,
    'priceUnit', v.price_unit,
    'priceNote', v.price_note,
    'callPhone', contact ->> 'call',
    'textPhone', contact ->> 'text',
    'whatsappPhone', contact ->> 'whatsapp',
    'preferredContact', contact ->> 'preferred',
    'instagramHandle', contact ->> 'instagram',
    'websiteUrl', contact ->> 'website',
    'languages', coalesce((
      select jsonb_agg(vl.language_code order by l.sort_order)
      from public.vendor_languages vl join public.languages l on l.code = vl.language_code
      where vl.vendor_id = p_vendor_id), '[]'::jsonb),
    'yearsInBusiness', v.years_in_business,
    'teamSize', v.team_size,
    'serviceRadiusMiles', v.service_radius_miles,
    'willTravel', v.will_travel,
    'travelNote', v.travel_fee_note,
    'officeHours', v.office_hours
  );
end;
$$;

-- One contact from the editor: saved, replaced or (null) removed
create function private.set_vendor_contact(p_vendor_id uuid, p_kind text, p_value text, p_field text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null then
    delete from public.vendor_contacts where vendor_id = p_vendor_id and kind = p_kind;
    return;
  end if;
  insert into public.vendor_contacts (vendor_id, kind, value, sort_order)
  values (p_vendor_id, p_kind, p_value,
    array_position(array['call', 'text', 'whatsapp', 'email', 'instagram', 'tiktok', 'facebook', 'website'], p_kind))
  on conflict (vendor_id, kind) do update set value = excluded.value;
exception
  when check_violation then
    raise exception 'invalid_field:%', p_field using errcode = '22023';
end;
$$;

revoke all on function private.set_vendor_contact from public, anon, authenticated;

create or replace function private.update_my_listing(p_vendor_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  editable text[] := array[
    'tagline', 'bio', 'priceDisplay', 'priceFrom', 'priceTo',
    'priceUnit', 'priceNote', 'callPhone', 'textPhone', 'whatsappPhone', 'preferredContact',
    'instagramHandle', 'websiteUrl', 'languages', 'yearsInBusiness', 'teamSize',
    'serviceRadiusMiles', 'willTravel', 'travelNote', 'officeHours'
  ];
  unknown text;
  c jsonb := p_changes;
  website text;
  preferred text;
  picked text[];
  failed_constraint text;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if c is null or jsonb_typeof(c) <> 'object' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  select k into unknown from jsonb_object_keys(c) as k where k <> all (editable) limit 1;
  if unknown is not null then
    raise exception 'not_editable:%', unknown using errcode = '42501';
  end if;
  if c ? 'languages' and jsonb_typeof(c -> 'languages') not in ('array', 'null') then
    raise exception 'invalid_field:languages' using errcode = '22023';
  end if;

  begin
    update public.vendors v set
      tagline = case when c ? 'tagline' then private.clean_text(c -> 'tagline') else v.tagline end,
      bio = case when c ? 'bio' then private.clean_text(c -> 'bio') else v.bio end,
      price_display = case when c ? 'priceDisplay'
        then coalesce(private.clean_text(c -> 'priceDisplay'), 'contact') else v.price_display end,
      price_from_cents = case when c ? 'priceFrom'
        then (private.clean_text(c -> 'priceFrom'))::integer * 100 else v.price_from_cents end,
      price_to_cents = case when c ? 'priceTo'
        then (private.clean_text(c -> 'priceTo'))::integer * 100 else v.price_to_cents end,
      price_unit = case when c ? 'priceUnit' then private.clean_text(c -> 'priceUnit') else v.price_unit end,
      price_note = case when c ? 'priceNote' then private.clean_text(c -> 'priceNote') else v.price_note end,
      years_in_business = case when c ? 'yearsInBusiness'
        then (private.clean_text(c -> 'yearsInBusiness'))::integer else v.years_in_business end,
      team_size = case when c ? 'teamSize' then (private.clean_text(c -> 'teamSize'))::integer else v.team_size end,
      service_radius_miles = case when c ? 'serviceRadiusMiles'
        then (private.clean_text(c -> 'serviceRadiusMiles'))::integer else v.service_radius_miles end,
      will_travel = case when c ? 'willTravel'
        then coalesce((private.clean_text(c -> 'willTravel'))::boolean, false) else v.will_travel end,
      travel_fee_note = case when c ? 'travelNote' then private.clean_text(c -> 'travelNote') else v.travel_fee_note end,
      office_hours = case when c ? 'officeHours' then private.clean_text(c -> 'officeHours') else v.office_hours end,
      updated_at = now()
    where v.id = p_vendor_id;
  exception
    when check_violation or not_null_violation then
      get stacked diagnostics failed_constraint = constraint_name;
      raise exception 'invalid_field:%', coalesce(
        case failed_constraint
          when 'vendors_tagline_check' then 'tagline'
          when 'vendors_bio_check' then 'bio'
          when 'vendors_price_display_check' then 'priceDisplay'
          when 'vendors_price_from_cents_check' then 'priceFrom'
          when 'vendors_price_to_cents_check' then 'priceTo'
          when 'vendors_price_unit_check' then 'priceUnit'
          when 'vendors_price_matches_display' then 'priceDisplay'
          when 'vendors_price_note_check' then 'priceNote'
          when 'vendors_years_in_business_check' then 'yearsInBusiness'
          when 'vendors_team_size_check' then 'teamSize'
          when 'vendors_service_radius_miles_check' then 'serviceRadiusMiles'
          when 'vendors_travel_fee_note_check' then 'travelNote'
          when 'vendors_office_hours_check' then 'officeHours'
        end,
        'unknown') using errcode = '22023';
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_field:number' using errcode = '22023';
  end;

  if c ? 'callPhone' then
    perform private.set_vendor_contact(p_vendor_id, 'call', private.clean_text(c -> 'callPhone'), 'callPhone');
  end if;
  if c ? 'textPhone' then
    perform private.set_vendor_contact(p_vendor_id, 'text', private.clean_text(c -> 'textPhone'), 'textPhone');
  end if;
  if c ? 'whatsappPhone' then
    perform private.set_vendor_contact(p_vendor_id, 'whatsapp', private.clean_text(c -> 'whatsappPhone'), 'whatsappPhone');
  end if;
  if c ? 'instagramHandle' then
    perform private.set_vendor_contact(p_vendor_id, 'instagram',
      ltrim(private.clean_text(c -> 'instagramHandle'), '@'), 'instagramHandle');
  end if;
  if c ? 'websiteUrl' then
    -- People type websites without https://
    website := private.clean_text(c -> 'websiteUrl');
    if website is not null and website !~* '^https?://' then
      website := 'https://' || website;
    end if;
    perform private.set_vendor_contact(p_vendor_id, 'website', website, 'websiteUrl');
  end if;

  if c ? 'preferredContact' then
    preferred := private.clean_text(c -> 'preferredContact');
    if preferred is not null and not exists (
      select 1 from public.vendor_contacts where vendor_id = p_vendor_id and kind = preferred
    ) then
      raise exception 'invalid_field:preferredContact' using errcode = '22023';
    end if;
    update public.vendor_contacts set is_preferred = (kind = preferred)
    where vendor_id = p_vendor_id and is_preferred is distinct from (kind = preferred);
  end if;

  if c ? 'languages' then
    picked := array(select jsonb_array_elements_text(coalesce(c -> 'languages', '[]'::jsonb)));
    if cardinality(picked) = 0
      or exists (select 1 from unnest(picked) p where not exists (select 1 from public.languages l where l.code = p)) then
      raise exception 'invalid_field:languages' using errcode = '22023';
    end if;
    delete from public.vendor_languages where vendor_id = p_vendor_id and language_code <> all (picked);
    insert into public.vendor_languages (vendor_id, language_code)
    select p_vendor_id, p from unnest(picked) p
    on conflict do nothing;
  end if;

  return private.my_listing(p_vendor_id);
end;
$$;

-- A family's view of a vendor's day --------------------------------------------------------

create or replace function public.vendor_date_status(p_vendor_id uuid, p_day date)
returns text
language sql
stable
set search_path = ''
as $$
  with vendor as (
    select v.id, v.calendar_updated_at
    from public.vendors v
    where v.id = p_vendor_id and v.status = 'published'
  ),
  marks as (
    select d.part, d.status
    from public.vendor_days d
    join vendor on vendor.id = d.vendor_id
    where d.day = p_day and d.status <> 'open'
  )
  select case
    when not exists (select 1 from vendor) then 'unknown'
    when exists (select 1 from marks where part = 'all_day' and status = 'booked') then 'booked'
    when (select count(*) from marks where part <> 'all_day' and status = 'booked') >= 2 then 'booked'
    when exists (select 1 from marks where part = 'all_day') then 'held'
    when exists (select 1 from marks) then 'partly'
    when (select calendar_updated_at from vendor) > now() - interval '60 days' then 'open'
    else 'unknown'
  end;
$$;

-- Search: prices in cents (max_price_cents), languages and days from their
-- tables, the city's name from cities. The signature changes, so it's made anew.
drop function public.search_vendors(double precision, double precision, integer, text, text, text, boolean, integer, integer, integer, integer, text, text, date);
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
      -- Venues that seat at least this many (vendors without a capacity, like
      -- a DJ, aren't filtered out)
      and (search_vendors.min_guests is null
        or jsonb_typeof(v.details -> 'seated_capacity') is distinct from 'number'
        or (v.details ->> 'seated_capacity')::numeric >= search_vendors.min_guests)
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

grant execute on function public.search_vendors to anon, authenticated, service_role;


-- The vendor's numbers come from their contacts
CREATE OR REPLACE FUNCTION public.create_inquiry(p_user_id uuid, p_vendor_id uuid, p_event_slugs text[], p_event_date date, p_start_time time without time zone, p_guest_band text, p_location text, p_message text, p_preferred_contact text, p_language text, p_details jsonb, p_sender_name text, p_sender_phone text, p_sender_email text, p_send_again boolean DEFAULT false)
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

  insert into public.inquiries (
    user_id, vendor_id, event_slugs, event_date, start_time, guest_band, location, message,
    preferred_contact, language, details, sender_name, sender_phone, sender_email, channel, status
  ) values (
    p_user_id, p_vendor_id, coalesce(p_event_slugs, '{}'), p_event_date, p_start_time,
    p_guest_band, btrim(p_location), btrim(p_message), p_preferred_contact,
    coalesce(p_language, 'en'), coalesce(p_details, '{}'), btrim(p_sender_name), p_sender_phone,
    p_sender_email, v_channel, v_status
  )
  returning id into v_id;

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


-- The checklist reads contacts and languages from their tables
CREATE OR REPLACE FUNCTION private.business_checklist(p_vendor_id uuid)
 RETURNS TABLE(key text, done boolean, count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    ('price', v.price_from_cents is not null or v.price_note is not null, null),
    ('contact', exists (select 1 from public.vendor_contacts c
      where c.vendor_id = p_vendor_id and c.kind in ('call', 'text', 'whatsapp')), null),
    ('instagram', exists (select 1 from public.vendor_contacts c
      where c.vendor_id = p_vendor_id and c.kind = 'instagram'), null),
    ('languages', exists (select 1 from public.vendor_languages l where l.vendor_id = p_vendor_id), null),
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
$function$;


-- The export names the city and reads the calendar from vendor_days
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
      from public.vendor_days d
      where d.vendor_id = p_vendor_id and d.day >= today - 365 and d.status <> 'open'
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
$function$;


-- Proposals name the vendor's city
CREATE OR REPLACE FUNCTION private.request_proposals_for(p_request_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_slug text, vendor_name text, vendor_city text, cover_path text, founding_number integer, price_cents integer, price_unit text, note text, menu_id uuid, reel_id uuid, status text, conversation_id uuid, created_at timestamp with time zone, vendor_is_sample boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.wedding_requests;
begin
  select * into r from public.wedding_requests wr where wr.id = p_request_id;
  if r.id is null or not exists (
    select 1 from public.wedding_members m where m.wedding_id = r.wedding_id and m.user_id = (select auth.uid())
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select rp.id, v.id, v.slug, v.name, (select c.name from public.cities c where c.slug = v.base_city_slug),
    (select vm.storage_path from public.vendor_media vm
     where vm.vendor_id = v.id order by vm.is_cover desc, vm.sort_order limit 1),
    v.founding_number::integer, rp.price_cents, rp.price_unit, rp.note, rp.menu_id, rp.reel_id,
    rp.status, rp.conversation_id, rp.created_at, v.is_sample
  from public.request_proposals rp
  join public.vendors v on v.id = rp.vendor_id
  where rp.request_id = r.id and rp.status <> 'withdrawn'
  order by (rp.status = 'accepted') desc, rp.created_at;
end;
$function$;


-- A new business starts in its city, as a self sign-up, speaking English
CREATE OR REPLACE FUNCTION private.start_my_business(p_name text, p_category_slug text, p_city_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  place public.cities;
  base text;
  new_slug text;
  v public.vendors;
begin
  if caller is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Founders call the number in About you before publishing.
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'needs_profile' using errcode = '42501';
  end if;
  p_name := nullif(btrim(p_name), '');
  if p_name is null or length(p_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where slug = p_category_slug) then
    raise exception 'invalid_category' using errcode = '22023';
  end if;
  select * into place from public.cities where slug = p_city_slug;
  if not found then
    raise exception 'invalid_city' using errcode = '22023';
  end if;

  -- A second tap, or coming back to sign-up, finds the draft already made.
  select vd.* into v from public.vendors vd
  join public.vendor_members m on m.vendor_id = vd.id and m.user_id = caller
  where vd.status = 'draft' and lower(vd.name) = lower(p_name)
  limit 1;
  if found then
    return jsonb_build_object('vendorId', v.id, 'slug', v.slug);
  end if;
  if (select count(*) from public.vendors vd
      join public.vendor_members m on m.vendor_id = vd.id and m.user_id = caller
      where vd.provenance = 'self_signup' and vd.status = 'draft') >= 3 then
    raise exception 'too_many_drafts' using errcode = 'P0001';
  end if;

  base := left(btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-'), 60);
  base := btrim(coalesce(nullif(base, ''), 'business'), '-');
  new_slug := base;
  while exists (select 1 from public.vendors where slug = new_slug) loop
    new_slug := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.vendors (slug, status, name, base_city_slug, location, provenance)
  values (new_slug, 'draft', p_name, place.slug, place.location, 'self_signup')
  returning * into v;
  insert into public.vendor_languages (vendor_id, language_code) values (v.id, 'en');
  insert into public.vendor_categories (vendor_id, category_slug, position)
  values (v.id, p_category_slug, 1);
  insert into public.vendor_members (vendor_id, user_id, role)
  values (v.id, caller, 'owner');
  return jsonb_build_object('vendorId', v.id, 'slug', v.slug);
end;
$function$;


-- The shortlist names each vendor's city
CREATE OR REPLACE FUNCTION private.wedding_shortlist(p_wedding_id uuid)
 RETURNS TABLE(vendor_id uuid, slug text, name text, city text, published boolean, event_slugs text[], saved_by text[], loves integer, maybes integer, nos integer, my_reaction text, loved_by text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with members as (
    select m.user_id
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and private.wedding_role(p_wedding_id) is not null
  ),
  saves as (
    select
      s.vendor_id,
      array_agg(distinct we.event_slug) filter (where we.event_slug is not null) as event_slugs,
      array_agg(distinct coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), '?')) as saved_by
    from public.saved_vendors s
    join members on members.user_id = s.user_id
    left join public.wedding_events we on we.id = s.wedding_event_id
    left join public.profiles p on p.id = s.user_id
    where s.wedding_id = p_wedding_id
    group by s.vendor_id
  ),
  reactions as (
    select
      r.vendor_id,
      (count(*) filter (where r.reaction = 'love'))::integer as loves,
      (count(*) filter (where r.reaction = 'maybe'))::integer as maybes,
      (count(*) filter (where r.reaction = 'no'))::integer as nos,
      max(r.reaction) filter (where r.user_id = (select auth.uid())) as my_reaction,
      array_agg(coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), '?'))
        filter (where r.reaction = 'love') as loved_by
    from public.shortlist_reactions r
    left join public.profiles p on p.id = r.user_id
    where r.wedding_id = p_wedding_id
      and r.user_id in (select user_id from members)
    group by r.vendor_id
  )
  select
    v.id, v.slug, v.name, (select c.name from public.cities c where c.slug = v.base_city_slug), v.status = 'published',
    coalesce(saves.event_slugs, '{}'), saves.saved_by,
    coalesce(reactions.loves, 0), coalesce(reactions.maybes, 0), coalesce(reactions.nos, 0),
    reactions.my_reaction, coalesce(reactions.loved_by, '{}')
  from saves
  join public.vendors v on v.id = saves.vendor_id
  left join reactions on reactions.vendor_id = saves.vendor_id
  order by coalesce(reactions.loves, 0) desc, coalesce(reactions.nos, 0), v.name;
$function$;
