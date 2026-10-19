-- Places, to the database design (Places and the calendar): markets above
-- cities, a state on every city, and every ZIP tied to its nearest city.
--
-- regions    The markets Wedded opens in: Yuba-Sutter, Sacramento, Bay Area,
--            209 North, 209 South, then Fresno and Bakersfield. A region is
--            live once it has enough vendors to be worth a family's search.
-- cities     Gain a state and a region; aliases are renamed nicknames (what
--            people type: sj, sac, yuba). The census id was only used to load
--            the list, so it goes.
-- zip_codes  Gain the nearest listed city within 25 miles, so a ZIP reads as
--            a town. Null when no listed city is that close.

create table public.regions (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null check (private.is_localized_text(name)),
  is_live boolean not null default false,
  launch_vendor_target smallint not null default 30 check (launch_vendor_target > 0),
  sort_order smallint not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.regions is
  'Markets: Yuba-Sutter, Sacramento, Bay Area, 209 North, 209 South, then Fresno and Bakersfield. A region goes live at about 30 vendors across 8 types.';

insert into public.regions (slug, name, is_live, sort_order) values
  ('yuba-sutter', '{"en": "Yuba-Sutter"}', true, 1),
  ('sacramento', '{"en": "Sacramento"}', true, 2),
  ('bay-area', '{"en": "Bay Area"}', true, 3),
  ('209-north', '{"en": "209 North"}', true, 4),
  ('209-south', '{"en": "209 South"}', true, 5),
  ('fresno', '{"en": "Fresno"}', false, 6),
  ('bakersfield', '{"en": "Bakersfield"}', false, 7);

create trigger set_updated_at before update on public.regions
  for each row execute function private.set_updated_at();

alter table public.regions enable row level security;
create policy "Places are readable by everyone" on public.regions
  for select to anon, authenticated using (true);
revoke all on public.regions from anon, authenticated;
grant select on public.regions to anon, authenticated;

-- Cities ----------------------------------------------------------------------

alter table public.cities rename column aliases to nicknames;
alter table public.cities drop column census_geoid;
alter table public.cities
  add column state text not null default 'CA' check (state ~ '^[A-Z]{2}$'),
  add column region_slug text references public.regions (slug) on update cascade;

comment on column public.cities.nicknames is
  'What people type for the city: sj, sac, yuba.';

update public.cities c
set region_slug = case
  when c.slug in ('davis', 'woodland', 'galt', 'dixon', 'vacaville') then 'sacramento'
  when c.area_code = '530' then 'yuba-sutter'
  when c.area_code = '916' then 'sacramento'
  when c.area_code in ('408', '415', '510', '650', '707', '925') then 'bay-area'
  when c.slug in ('stockton', 'lodi', 'manteca', 'tracy', 'lathrop', 'ripon', 'escalon', 'mountain-house')
    then '209-north'
  when c.area_code = '209' then '209-south'
  when c.area_code = '559' then 'fresno'
end;

alter table public.cities alter column region_slug set not null;
create index cities_region_slug_idx on public.cities (region_slug);

-- ZIP codes -------------------------------------------------------------------

alter table public.zip_codes
  add column city_slug text references public.cities (slug) on update cascade;

comment on column public.zip_codes.city_slug is
  'The nearest listed city within 25 miles, so the ZIP reads as a town. Null when none is that close.';

update public.zip_codes z
set city_slug = (
  select c.slug
  from public.cities c
  where extensions.st_dwithin(c.location, z.location, 25 * 1609.344)
  order by extensions.st_distance(c.location, z.location)
  limit 1
);

create index zip_codes_city_slug_idx on public.zip_codes (city_slug);
