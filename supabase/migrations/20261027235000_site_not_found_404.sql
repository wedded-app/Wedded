-- A made-up or unpublished /w/ link answered HTTP 500: site_page() raised
-- site_not_found as P0002, and PostgREST turns P0 codes other than P0001 into
-- 500. It now answers 404 through PostgREST's own PGRST error, with the same
-- site_not_found message the app already reads (siteProblem()).

CREATE OR REPLACE FUNCTION private.site_page(p_slug text, p_password text, p_guest_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  site public.wedding_sites;
  wed public.weddings;
  member_role text;
  guest public.wedding_guests;
  site_lock public.wedding_site_locks;
  invited integer := 0;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  event_list jsonb;
  lists jsonb;
begin
  select * into site from public.wedding_sites s where s.slug = lower(btrim(coalesce(p_slug, '')));
  if not found then
    raise sqlstate 'PGRST' using message = '{"code":"site_not_found","message":"site_not_found"}', detail = '{"status":404,"headers":{}}';
  end if;
  member_role := private.wedding_role(site.wedding_id);
  if site.published_at is null and member_role is null then
    raise sqlstate 'PGRST' using message = '{"code":"site_not_found","message":"site_not_found"}', detail = '{"status":404,"headers":{}}';
  end if;
  select * into wed from public.weddings w where w.id = site.wedding_id;

  if coalesce(btrim(p_guest_token), '') <> '' then
    select * into guest from public.wedding_guests g
    where g.rsvp_token = lower(btrim(p_guest_token)) and g.wedding_id = site.wedding_id;
  end if;

  if member_role is null and guest.id is null then
    select * into site_lock from public.wedding_site_locks l where l.site_id = site.id;
    if site_lock.password_hash is not null then
      if coalesce(btrim(p_password), '') = '' then
        return jsonb_build_object('locked', 'password_required', 'title', wed.title,
          'design', site.design, 'palette', site.palette);
      end if;
      if site_lock.miss_day = today and site_lock.misses >= 30 then
        raise exception 'password_limit' using errcode = 'P0001';
      end if;
      if extensions.crypt(lower(btrim(p_password)), site_lock.password_hash) <> site_lock.password_hash then
        update public.wedding_site_locks l
        set misses = case when l.miss_day = today then l.misses + 1 else 1 end, miss_day = today
        where l.site_id = site.id;
        return jsonb_build_object('locked', 'wrong_password', 'title', wed.title,
          'design', site.design, 'palette', site.palette);
      end if;
    end if;
  end if;

  if guest.id is not null then
    select count(*) into invited from public.guest_invites i where i.guest_id = guest.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', e.event_slug,
      'date', e.event_date,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      -- A listed hall or gurdwara by its name, else what the family typed
      'place', coalesce(v.name, e.venue_text),
      'city', c.name,
      'dress_code', e.dress_code,
      'dress_colors', to_jsonb(e.dress_colors),
      'note', e.guest_note,
      'shown_publicly', e.shown_publicly,
      'rsvp', i.rsvp,
      'coming', i.coming
    ) order by e.event_date nulls last, e.starts_at nulls last, e.event_slug), '[]'::jsonb)
  into event_list
  from public.wedding_events e
  left join public.vendors v on v.id = e.venue_id
  left join public.cities c on c.slug = e.city_slug
  left join public.guest_invites i on i.wedding_event_id = e.id and i.guest_id = guest.id
  where e.wedding_id = site.wedding_id
    and case
      when invited > 0 then i.guest_id is not null
      when guest.id is null and member_role is not null then true
      else e.shown_publicly
    end;

  select coalesce(jsonb_object_agg(k.kind, k.list), '{}'::jsonb)
  into lists
  from (
    select it.kind,
      jsonb_agg(jsonb_build_object('title', it.title, 'body', it.body, 'link', it.link)
        order by it.position) as list
    from public.wedding_site_items it
    where it.site_id = site.id
    group by it.kind
  ) k;

  return jsonb_build_object(
    'slug', site.slug,
    'title', wed.title,
    'wedding_date', wed.wedding_date,
    'design', site.design,
    'palette', site.palette,
    'cover_path', site.cover_path,
    'welcome', site.welcome,
    'story', site.story,
    'family_title', site.family_title,
    'family_lines', to_jsonb(site.family_lines),
    'guide_title', site.guide_title,
    'livestream_url', site.livestream_url,
    'livestream_note', site.livestream_note,
    'rsvp_by', site.rsvp_by,
    'sections', to_jsonb(site.sections),
    'searchable', site.searchable,
    'published_at', site.published_at,
    -- The wedding's shared RSVP link, for "Find your invitation"
    'rsvp_link', wed.rsvp_token,
    'guest', case when guest.id is null then null else jsonb_build_object(
      'name', guest.name, 'party_size', guest.party_size, 'token', guest.rsvp_token) end,
    'events', event_list,
    'tips', coalesce(lists -> 'tip', '[]'::jsonb),
    'hotels', coalesce(lists -> 'hotel', '[]'::jsonb),
    'faq', coalesce(lists -> 'faq', '[]'::jsonb),
    'editor', case when member_role is null then null else jsonb_build_object(
      'wedding_id', site.wedding_id,
      'role', member_role,
      'can_edit', member_role in ('owner', 'editor'),
      'has_password', exists (
        select 1 from public.wedding_site_locks l
        where l.site_id = site.id and l.password_hash is not null)) end
  );
end;
$function$;
