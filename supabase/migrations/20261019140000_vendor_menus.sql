-- Menus, to the database design (vendor_menus, menu_items): the dishes become
-- rows under titled sections instead of a JSON list, prices are cents, the
-- diet tags are named like the rest, and a menu can belong to one event.
-- Vendors save a menu and its dishes together through save_vendor_menu().
--
-- Kept from today though the design leaves them out: a menu's description
-- and a dish's description, both written by the vendor.

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.vendor_menus (id) on delete cascade,
  section text not null check (length(btrim(section)) between 1 and 60),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text check (length(btrim(description)) between 1 and 300),
  diet_tags text[] not null default '{}'
    check (diet_tags <@ array['veg', 'non_veg', 'jhatka', 'halal', 'jain', 'eggless', 'vegan', 'gluten_free']),
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  constraint menu_items_order unique (menu_id, sort_order)
);

comment on table public.menu_items is
  'Dishes in a menu under titled sections (starters, mains, live counters), in order.';

insert into public.menu_items (menu_id, section, name, description, diet_tags, sort_order)
select m.id,
  btrim(s.value ->> 'title'),
  btrim(i.value ->> 'name'),
  nullif(left(btrim(i.value ->> 'description'), 300), ''),
  array(
    select t from jsonb_array_elements_text(coalesce(i.value -> 'diet', '[]'::jsonb)) as d (t)
    where t in ('veg', 'non_veg', 'jhatka', 'halal', 'jain', 'eggless', 'vegan', 'gluten_free')
  ),
  row_number() over (partition by m.id order by s.ordinality, i.ordinality)
from public.vendor_menus m
cross join lateral jsonb_array_elements(m.sections) with ordinality as s (value, ordinality)
cross join lateral jsonb_array_elements(s.value -> 'items') with ordinality as i (value, ordinality);

alter table public.menu_items enable row level security;
create policy "Readable with the menu" on public.menu_items
  for select to anon, authenticated
  using (exists (select 1 from public.vendor_menus m where m.id = menu_id));
revoke all on public.menu_items from anon, authenticated;
grant select on public.menu_items to anon, authenticated;

-- The menu itself ----------------------------------------------------------------------------

alter table public.vendor_menus drop constraint vendor_menus_sections_check;
alter table public.vendor_menus drop column sections;
drop function private.is_menu_sections(jsonb);

alter table public.vendor_menus rename column price_from to price_from_cents;
update public.vendor_menus set price_from_cents = price_from_cents * 100;
alter table public.vendor_menus rename constraint vendor_menus_price_from_check to vendor_menus_price_from_cents_check;
alter table public.vendor_menus rename column diet to diet_tags;
alter table public.vendor_menus rename constraint vendor_menus_diet_check to vendor_menus_diet_tags_check;
alter table public.vendor_menus add column event_slug text references public.events (slug) on update cascade;
create index vendor_menus_event_slug_idx on public.vendor_menus (event_slug);

comment on column public.vendor_menus.price_from_cents is 'US cents, per price_unit (person, plate or event).';
comment on column public.vendor_menus.event_slug is 'A menu for one event (a mehndi lunch); null for any.';

-- Writes go through save_vendor_menu(); vendors still remove menus directly
drop policy "The vendor's people add menus" on public.vendor_menus;
drop policy "The vendor's people change menus" on public.vendor_menus;
revoke insert, update on public.vendor_menus from authenticated;

-- A vendor's people add a menu (no id) or change one, with its dishes
create function private.save_vendor_menu(p_vendor_id uuid, p_menu_id uuid, p_menu jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid := p_menu_id;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_menu is null or jsonb_typeof(p_menu) <> 'object'
    or jsonb_typeof(coalesce(p_menu -> 'sections', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_menu -> 'sections', '[]'::jsonb)) > 20
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_menu -> 'sections', '[]'::jsonb)) as s
      where jsonb_typeof(s -> 'items') is distinct from 'array' or jsonb_array_length(s -> 'items') > 60
    )
  then
    raise exception 'invalid_menu' using errcode = '22023';
  end if;

  begin
    if saved_id is null then
      insert into public.vendor_menus
        (vendor_id, name, description, cuisine, diet_tags, price_from_cents, price_unit, min_guests, event_slug)
      values (
        p_vendor_id,
        btrim(p_menu ->> 'name'),
        nullif(btrim(p_menu ->> 'description'), ''),
        nullif(btrim(p_menu ->> 'cuisine'), ''),
        array(select jsonb_array_elements_text(coalesce(p_menu -> 'diet_tags', '[]'::jsonb))),
        (p_menu ->> 'price_from_cents')::integer,
        p_menu ->> 'price_unit',
        (p_menu ->> 'min_guests')::integer,
        p_menu ->> 'event_slug'
      )
      returning id into saved_id;
    else
      update public.vendor_menus set
        name = btrim(p_menu ->> 'name'),
        description = nullif(btrim(p_menu ->> 'description'), ''),
        cuisine = nullif(btrim(p_menu ->> 'cuisine'), ''),
        diet_tags = array(select jsonb_array_elements_text(coalesce(p_menu -> 'diet_tags', '[]'::jsonb))),
        price_from_cents = (p_menu ->> 'price_from_cents')::integer,
        price_unit = p_menu ->> 'price_unit',
        min_guests = (p_menu ->> 'min_guests')::integer,
        event_slug = p_menu ->> 'event_slug'
      where id = saved_id and vendor_id = p_vendor_id;
      if not found then
        raise exception 'menu_not_found' using errcode = 'P0002';
      end if;
      delete from public.menu_items where menu_id = saved_id;
    end if;

    insert into public.menu_items (menu_id, section, name, description, diet_tags, sort_order)
    select saved_id,
      btrim(s.value ->> 'title'),
      btrim(i.value ->> 'name'),
      nullif(btrim(i.value ->> 'description'), ''),
      array(select jsonb_array_elements_text(coalesce(i.value -> 'diet_tags', '[]'::jsonb))),
      row_number() over (order by s.ordinality, i.ordinality)
    from jsonb_array_elements(coalesce(p_menu -> 'sections', '[]'::jsonb)) with ordinality as s (value, ordinality)
    cross join lateral jsonb_array_elements(s.value -> 'items') with ordinality as i (value, ordinality);
  exception
    when check_violation or not_null_violation or foreign_key_violation
      or invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_menu' using errcode = '22023';
  end;
  return saved_id;
end;
$$;

create function public.save_vendor_menu(p_vendor_id uuid, p_menu jsonb, p_menu_id uuid default null)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_vendor_menu(p_vendor_id, p_menu_id, p_menu);
$$;

comment on function public.save_vendor_menu is
  'The vendor''s people: add a menu (no p_menu_id) or change one, replacing its dishes. p_menu: {name, description, cuisine, diet_tags, price_from_cents, price_unit, min_guests, event_slug, sections: [{title, items: [{name, description, diet_tags}]}]}. Returns the menu id. Errors: not_allowed, invalid_menu, menu_not_found.';

revoke all on function private.save_vendor_menu, public.save_vendor_menu from public, anon;
grant execute on function private.save_vendor_menu, public.save_vendor_menu to authenticated;

-- The export rebuilds each menu's sections from its dishes
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
