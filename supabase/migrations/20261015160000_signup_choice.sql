-- Choose at sign-up (R5, #222): planning, just looking, or a wedding business.
--
-- profiles.joined_as        What the person picked. Everyone fills in the same
--                           About you form; the choice only changes what the
--                           app shows first (Kirat, 2026-10-15).
-- start_my_business(...)    A wedding business signs itself up: an unpublished
--                           listing with the caller as its owner, filled in
--                           under My business. Founders publish it in Studio
--                           (vendors where source = 'self_signup' and
--                           status = 'draft'); drafts never show in search,
--                           reels or profiles until then.

alter table public.profiles
  add column joined_as text check (joined_as in ('planning', 'looking', 'business'));

comment on column public.profiles.joined_as is
  'What they picked at sign-up: planning, looking (just looking) or business. Null for people who joined before the choice existed.';

grant insert (joined_as), update (joined_as) on public.profiles to authenticated;

create function private.start_my_business(p_name text, p_category_slug text, p_city_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
      where vd.source = 'self_signup' and vd.status = 'draft') >= 3 then
    raise exception 'too_many_drafts' using errcode = 'P0001';
  end if;

  base := left(btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-'), 60);
  base := btrim(coalesce(nullif(base, ''), 'business'), '-');
  new_slug := base;
  while exists (select 1 from public.vendors where slug = new_slug) loop
    new_slug := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.vendors (slug, status, name, city, location, source)
  values (new_slug, 'draft', p_name, place.name, place.location, 'self_signup')
  returning * into v;
  insert into public.vendor_categories (vendor_id, category_slug, position)
  values (v.id, p_category_slug, 1);
  insert into public.vendor_members (vendor_id, user_id, role)
  values (v.id, caller, 'owner');
  return jsonb_build_object('vendorId', v.id, 'slug', v.slug);
end;
$$;

create function public.start_my_business(p_name text, p_category_slug text, p_city_slug text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.start_my_business(p_name, p_category_slug, p_city_slug);
$$;

comment on function public.start_my_business is
  'A wedding business signs itself up: makes an unpublished listing (name, vendor type, city) with the caller as owner, or returns their draft of the same name. Founders publish it. Returns {vendorId, slug}. At most 3 drafts each. Errors: not_allowed, needs_profile, invalid_name, invalid_category, invalid_city, too_many_drafts.';

revoke all on function private.start_my_business, public.start_my_business from public;
grant execute on function private.start_my_business, public.start_my_business to authenticated;
