-- English only (2026-10-15, Kirat): Punjabi comes out of the app and the
-- database. Names keep their {"en": …} shape so the app's lookups stay, and a
-- language can come back later as a new key.
--
-- 1. Strip "pa" from every localized name while the old rule still allows it.
-- 2. Localized text is now English only.
-- 3. Gurmukhi search words go.
-- 4. Functions that returned or searched Punjabi are rebuilt without it.
-- 5. The vendor-written Punjabi columns are dropped.

update public.cultures set name = name - 'pa' where name ? 'pa';
update public.backgrounds set name = name - 'pa' where name ? 'pa';
update public.faiths set name = name - 'pa' where name ? 'pa';
update public.category_groups set name = name - 'pa' where name ? 'pa';
update public.categories set name = name - 'pa' where name ? 'pa';
update public.events set name = name - 'pa' where name ? 'pa';
update public.events set summary = summary - 'pa' where summary ? 'pa';
update public.events set timing = timing - 'pa' where timing ? 'pa';
update public.culture_events set local_name = local_name - 'pa' where local_name ? 'pa';
update public.area_codes set label = label - 'pa' where label ? 'pa';

create or replace function private.is_localized_text(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- coalesce: a missing key makes the comparisons NULL, and a CHECK
  -- constraint lets NULL through, so NULL must count as false.
  select coalesce(
    case
      when jsonb_typeof(value) is distinct from 'object' then false
      else
        jsonb_typeof(value -> 'en') = 'string'
        and length(btrim(value ->> 'en')) > 0
        and not exists (
          select 1
          from jsonb_object_keys(value) as k (key)
          where k.key <> 'en'
        )
    end,
    false
  );
$$;

-- Gurmukhi letters are U+0A00 to U+0A7F
update public.categories
set aliases = array(select a from unnest(aliases) as a where a !~ '[਀-੿]')
where array_to_string(aliases, ' ') ~ '[਀-੿]';
update public.events
set aliases = array(select a from unnest(aliases) as a where a !~ '[਀-੿]')
where array_to_string(aliases, ' ') ~ '[਀-੿]';
update public.cities
set aliases = array(select a from unnest(aliases) as a where a !~ '[਀-੿]')
where array_to_string(aliases, ' ') ~ '[਀-੿]';

drop function public.my_businesses();
drop function private.my_businesses();
drop function public.my_conversations();
drop function private.my_conversations();
drop function public.request_proposals_for(p_request_id uuid);
drop function private.request_proposals_for(p_request_id uuid);
drop function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date);
drop function public.wedding_shortlist(p_wedding_id uuid);
drop function private.wedding_shortlist(p_wedding_id uuid);

create or replace function private.business_checklist(p_vendor_id uuid)
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
    ('price', v.price_from is not null or v.price_note is not null, null),
    ('contact', coalesce(v.call_phone, v.whatsapp_phone, v.text_phone) is not null, null),
    ('instagram', v.instagram_handle is not null, null),
    ('languages', coalesce(cardinality(v.languages), 0) > 0, null),
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

create or replace function public.business_checklist(p_vendor_id uuid)
 RETURNS TABLE(key text, done boolean, count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.business_checklist(p_vendor_id);
$function$;
comment on function public.business_checklist(p_vendor_id uuid) is
  'What a vendor''s listing has and is missing (photos, cover, tagline, bios, price, contact, Instagram, languages, a fresh calendar, a reel, and menus for venues and caterers). Only the vendor''s members.';

create or replace function private.my_businesses()
 RETURNS TABLE(id uuid, slug text, name text, status text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select v.id, v.slug, v.name, v.status, m.role
  from public.vendor_members m
  join public.vendors v on v.id = m.vendor_id
  where m.user_id = (select auth.uid())
  order by v.name;
$function$;
revoke all on function private.my_businesses() from public;
grant execute on function private.my_businesses() to authenticated;

create or replace function public.my_businesses()
 RETURNS TABLE(id uuid, slug text, name text, status text, role text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.my_businesses();
$function$;
comment on function public.my_businesses() is
  'The vendors the signed-in person runs (owner or staff), drafts included.';
revoke all on function public.my_businesses() from public;
grant execute on function public.my_businesses() to anon, authenticated, service_role;

create or replace function private.my_conversations()
 RETURNS TABLE(id uuid, side text, vendor_id uuid, vendor_slug text, vendor_name text, vendor_cover_path text, family_name text, last_message_at timestamp with time zone, last_kind text, last_body text, last_sender_role text, unread_count integer, other_read_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select c.*, case when c.family_user_id = (select auth.uid()) then 'family' else 'vendor' end as side
    from public.conversations c
    where c.family_user_id = (select auth.uid()) or private.is_vendor_member(c.vendor_id)
  )
  select
    mine.id,
    mine.side,
    v.id,
    v.slug,
    v.name,
    (select vm.storage_path from public.vendor_media vm
     where vm.vendor_id = v.id order by vm.is_cover desc, vm.sort_order limit 1),
    mine.family_name,
    mine.last_message_at,
    last.kind,
    last.body,
    last.sender_role,
    (select count(*)::integer from public.messages m
     where m.conversation_id = mine.id
       and m.sender_role <> mine.side
       and m.created_at > coalesce(case when mine.side = 'family' then mine.family_read_at else mine.vendor_read_at end, '-infinity')),
    case when mine.side = 'family' then mine.vendor_read_at else mine.family_read_at end
  from mine
  join public.vendors v on v.id = mine.vendor_id
  left join lateral (
    select m.kind, m.body, m.sender_role
    from public.messages m
    where m.conversation_id = mine.id
    order by m.created_at desc
    limit 1
  ) last on true
  order by mine.last_message_at desc;
$function$;
revoke all on function private.my_conversations() from public;
grant execute on function private.my_conversations() to authenticated;

create or replace function public.my_conversations()
 RETURNS TABLE(id uuid, side text, vendor_id uuid, vendor_slug text, vendor_name text, vendor_cover_path text, family_name text, last_message_at timestamp with time zone, last_kind text, last_body text, last_sender_role text, unread_count integer, other_read_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.my_conversations();
$function$;
comment on function public.my_conversations() is
  'The caller''s inbox: conversations as a family or as a vendor member, newest first, with the last message and unread count.';
revoke all on function public.my_conversations() from public;
grant execute on function public.my_conversations() to anon, authenticated, service_role;

create or replace function private.my_listing(p_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.vendors;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v from public.vendors where id = p_vendor_id;
  return jsonb_build_object(
    'name', v.name,
    'slug', v.slug,
    'status', v.status,
    'city', v.city,
    'tagline', v.tagline,
    'bio', v.bio,
    'priceDisplay', v.price_display,
    'priceFrom', v.price_from,
    'priceTo', v.price_to,
    'priceUnit', v.price_unit,
    'priceNote', v.price_note,
    'callPhone', v.call_phone,
    'textPhone', v.text_phone,
    'whatsappPhone', v.whatsapp_phone,
    'preferredContact', v.preferred_contact,
    'instagramHandle', v.instagram_handle,
    'websiteUrl', v.website_url,
    'languages', to_jsonb(v.languages),
    'yearsInBusiness', v.years_in_business,
    'teamSize', v.team_size,
    'serviceRadiusMiles', v.service_radius_miles,
    'willTravel', v.will_travel,
    'travelNote', v.travel_note,
    'officeHours', v.office_hours
  );
end;
$function$;

create or replace function public.my_listing(p_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.my_listing(p_vendor_id);
$function$;
comment on function public.my_listing(p_vendor_id uuid) is
  'The listing fields a vendor''s people can edit, drafts included. Only the vendor''s members.';

create or replace function private.request_proposals_for(p_request_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_slug text, vendor_name text, vendor_city text, cover_path text, founding_number integer, price_cents integer, price_unit text, note text, menu_id uuid, reel_id uuid, status text, conversation_id uuid, created_at timestamp with time zone)
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
  select rp.id, v.id, v.slug, v.name, v.city,
    (select vm.storage_path from public.vendor_media vm
     where vm.vendor_id = v.id order by vm.is_cover desc, vm.sort_order limit 1),
    v.founding_number::integer, rp.price_cents, rp.price_unit, rp.note, rp.menu_id, rp.reel_id,
    rp.status, rp.conversation_id, rp.created_at
  from public.request_proposals rp
  join public.vendors v on v.id = rp.vendor_id
  where rp.request_id = r.id and rp.status <> 'withdrawn'
  order by (rp.status = 'accepted') desc, rp.created_at;
end;
$function$;
revoke all on function private.request_proposals_for(p_request_id uuid) from public;
grant execute on function private.request_proposals_for(p_request_id uuid) to authenticated;

create or replace function public.request_proposals_for(p_request_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_slug text, vendor_name text, vendor_city text, cover_path text, founding_number integer, price_cents integer, price_unit text, note text, menu_id uuid, reel_id uuid, status text, conversation_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.request_proposals_for(p_request_id);
$function$;
comment on function public.request_proposals_for(p_request_id uuid) is
  'The proposals on a request, for its wedding''s members: the vendor (name, town, cover photo, founding number), price, note, menu or reel, and status. Errors: not_allowed.';
revoke all on function public.request_proposals_for(p_request_id uuid) from public;
grant execute on function public.request_proposals_for(p_request_id uuid) to anon, authenticated, service_role;

create or replace function public.search_vendors(lat double precision DEFAULT NULL::double precision, lng double precision DEFAULT NULL::double precision, max_miles integer DEFAULT 25, category_slug text DEFAULT NULL::text, event_slug text DEFAULT NULL::text, query text DEFAULT NULL::text, include_travelers boolean DEFAULT false, result_limit integer DEFAULT 50, result_offset integer DEFAULT 0, min_guests integer DEFAULT NULL::integer, max_price integer DEFAULT NULL::integer, language text DEFAULT NULL::text, sort text DEFAULT 'distance'::text, available_on date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, slug text, name text, city text, primary_category_slug text, primary_category_name jsonb, price_display text, price_from integer, price_to integer, price_unit text, founding_number smallint, distance_miles double precision, within_search_radius boolean, latitude double precision, longitude double precision, cover_path text)
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
      '%' || replace(replace(replace(t.text, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
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
      and (search_vendors.max_price is null
        or v.price_display not in ('starting_at', 'range')
        or v.price_from is null
        or v.price_from <= search_vendors.max_price)
      and (search_vendors.language is null or search_vendors.language = any (v.languages))
      -- Not booked all day on the family's date (held or partly booked stays in)
      and (search_vendors.available_on is null or not exists (
        select 1 from public.vendor_unavailable_days u
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
    m.city,
    pc.category_slug,
    c.name,
    m.price_display,
    m.price_from,
    m.price_to,
    m.price_unit,
    m.founding_number,
    m.miles,
    case when m.miles is null or search_vendors.max_miles is null then null
      else m.miles <= search_vendors.max_miles end,
    extensions.st_y(m.location::extensions.geometry),
    extensions.st_x(m.location::extensions.geometry),
    cover.storage_path
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
      then m.price_from end nulls last,
    case when search_vendors.sort = 'founding' then m.founding_number end nulls last,
    m.miles nulls last, m.founding_number nulls last, (cover.storage_path is null), m.name
  limit least(greatest(search_vendors.result_limit, 1), 100)
  offset greatest(search_vendors.result_offset, 0);
$function$;
comment on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) is
  'Published vendors near a point (or anywhere when no point), filtered by category, event, text, guest capacity, price ceiling, language and a date they''re not booked on, sorted by distance (or price or founding number). Includes vendors whose service radius covers the searcher. Text falls back to close spellings when nothing matches exactly.';
revoke all on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) from public;
grant execute on function public.search_vendors(lat double precision, lng double precision, max_miles integer, category_slug text, event_slug text, query text, include_travelers boolean, result_limit integer, result_offset integer, min_guests integer, max_price integer, language text, sort text, available_on date) to anon, authenticated, service_role;

create or replace function private.update_my_listing(p_vendor_id uuid, p_changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Families type websites without https://
  website := private.clean_text(c -> 'websiteUrl');
  if website is not null and website !~* '^https?://' then
    website := 'https://' || website;
  end if;

  begin
    update public.vendors v set
      tagline = case when c ? 'tagline' then private.clean_text(c -> 'tagline') else v.tagline end,
      bio = case when c ? 'bio' then private.clean_text(c -> 'bio') else v.bio end,
      price_display = case when c ? 'priceDisplay'
        then coalesce(private.clean_text(c -> 'priceDisplay'), 'contact') else v.price_display end,
      price_from = case when c ? 'priceFrom' then (private.clean_text(c -> 'priceFrom'))::integer else v.price_from end,
      price_to = case when c ? 'priceTo' then (private.clean_text(c -> 'priceTo'))::integer else v.price_to end,
      price_unit = case when c ? 'priceUnit' then private.clean_text(c -> 'priceUnit') else v.price_unit end,
      price_note = case when c ? 'priceNote' then private.clean_text(c -> 'priceNote') else v.price_note end,
      call_phone = case when c ? 'callPhone' then private.clean_text(c -> 'callPhone') else v.call_phone end,
      text_phone = case when c ? 'textPhone' then private.clean_text(c -> 'textPhone') else v.text_phone end,
      whatsapp_phone = case when c ? 'whatsappPhone' then private.clean_text(c -> 'whatsappPhone') else v.whatsapp_phone end,
      preferred_contact = case when c ? 'preferredContact'
        then private.clean_text(c -> 'preferredContact') else v.preferred_contact end,
      instagram_handle = case when c ? 'instagramHandle'
        then ltrim(private.clean_text(c -> 'instagramHandle'), '@') else v.instagram_handle end,
      website_url = case when c ? 'websiteUrl' then website else v.website_url end,
      languages = case when c ? 'languages'
        then array(select jsonb_array_elements_text(coalesce(c -> 'languages', '[]'::jsonb)))
        else v.languages end,
      years_in_business = case when c ? 'yearsInBusiness'
        then (private.clean_text(c -> 'yearsInBusiness'))::integer else v.years_in_business end,
      team_size = case when c ? 'teamSize' then (private.clean_text(c -> 'teamSize'))::integer else v.team_size end,
      service_radius_miles = case when c ? 'serviceRadiusMiles'
        then (private.clean_text(c -> 'serviceRadiusMiles'))::integer else v.service_radius_miles end,
      will_travel = case when c ? 'willTravel'
        then coalesce((private.clean_text(c -> 'willTravel'))::boolean, false) else v.will_travel end,
      travel_note = case when c ? 'travelNote' then private.clean_text(c -> 'travelNote') else v.travel_note end,
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
          when 'vendors_price_from_check' then 'priceFrom'
          when 'vendors_price_to_check' then 'priceTo'
          when 'vendors_price_unit_check' then 'priceUnit'
          when 'vendors_price_matches_display' then 'priceDisplay'
          when 'vendors_price_note_check' then 'priceNote'
          when 'vendors_call_phone_check' then 'callPhone'
          when 'vendors_text_phone_check' then 'textPhone'
          when 'vendors_whatsapp_phone_check' then 'whatsappPhone'
          when 'vendors_preferred_contact_check' then 'preferredContact'
          when 'vendors_instagram_handle_check' then 'instagramHandle'
          when 'vendors_website_url_check' then 'websiteUrl'
          when 'vendors_languages_check' then 'languages'
          when 'vendors_years_in_business_check' then 'yearsInBusiness'
          when 'vendors_team_size_check' then 'teamSize'
          when 'vendors_service_radius_miles_check' then 'serviceRadiusMiles'
          when 'vendors_travel_note_check' then 'travelNote'
          when 'vendors_office_hours_check' then 'officeHours'
        end,
        'unknown') using errcode = '22023';
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_field:number' using errcode = '22023';
  end;

  return private.my_listing(p_vendor_id);
end;
$function$;

create or replace function public.update_my_listing(p_vendor_id uuid, p_changes jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.update_my_listing(p_vendor_id, p_changes);
$function$;
comment on function public.update_my_listing(p_vendor_id uuid, p_changes jsonb) is
  'Save changes to the editable listing fields ({tagline: "…", priceFrom: 45, …}; null clears one) and return the listing. Only the vendor''s members. Errors: not_allowed, invalid_changes, not_editable:<key>, invalid_field:<key>.';

create or replace function private.wedding_shortlist(p_wedding_id uuid)
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
      array_agg(distinct s.event_slug) filter (where s.event_slug is not null) as event_slugs,
      array_agg(distinct coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), '?')) as saved_by
    from public.saved_vendors s
    join members on members.user_id = s.user_id
    left join public.profiles p on p.id = s.user_id
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
    from public.wedding_reactions r
    left join public.profiles p on p.id = r.user_id
    where r.wedding_id = p_wedding_id
      and r.user_id in (select user_id from members)
    group by r.vendor_id
  )
  select
    v.id, v.slug, v.name, v.city, v.status = 'published',
    coalesce(saves.event_slugs, '{}'), saves.saved_by,
    coalesce(reactions.loves, 0), coalesce(reactions.maybes, 0), coalesce(reactions.nos, 0),
    reactions.my_reaction, coalesce(reactions.loved_by, '{}')
  from saves
  join public.vendors v on v.id = saves.vendor_id
  left join reactions on reactions.vendor_id = saves.vendor_id
  order by coalesce(reactions.loves, 0) desc, coalesce(reactions.nos, 0), v.name;
$function$;
revoke all on function private.wedding_shortlist(p_wedding_id uuid) from public;
grant execute on function private.wedding_shortlist(p_wedding_id uuid) to authenticated;

create or replace function public.wedding_shortlist(p_wedding_id uuid)
 RETURNS TABLE(vendor_id uuid, slug text, name text, city text, published boolean, event_slugs text[], saved_by text[], loves integer, maybes integer, nos integer, my_reaction text, loved_by text[])
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.wedding_shortlist(p_wedding_id);
$function$;
comment on function public.wedding_shortlist(p_wedding_id uuid) is
  'For members: every vendor a member of the wedding saved, with the events, who saved it (first names), reaction counts, your reaction and who loves it. Best loved first.';
revoke all on function public.wedding_shortlist(p_wedding_id uuid) from public;
grant execute on function public.wedding_shortlist(p_wedding_id uuid) to anon, authenticated, service_role;

-- Menu sections carried Punjabi too: title_pa on a section, name_pa on a dish
update public.vendor_menus
set sections = (
  select coalesce(jsonb_agg(
    (s - 'title_pa') || jsonb_build_object('items', (
      select coalesce(jsonb_agg(i - 'name_pa'), '[]'::jsonb)
      from jsonb_array_elements(s -> 'items') as i
    ))
  ), '[]'::jsonb)
  from jsonb_array_elements(sections) as s
)
where sections::text ~ '"(title|name)_pa"';

alter table public.vendors drop column name_pa, drop column tagline_pa, drop column bio_pa;
alter table public.vendor_menus drop column name_pa, drop column description_pa;

-- Which script a culture writes in only chose fonts for Punjabi mode
alter table public.cultures drop column script;
