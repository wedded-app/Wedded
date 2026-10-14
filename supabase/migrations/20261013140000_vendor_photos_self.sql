-- Vendors add and arrange their own photos (C6d, #212). The phone makes the
-- three sizes the app shows (400, 1080 and 1600 wide, WebP) and uploads them
-- to the public vendor-media bucket under <vendor id>/<photo id>/, the same
-- layout as the founders' upload script. Then:
--
-- add_vendor_photo()        saves the photo once its files are there (the
--                           first becomes the cover; 60 a vendor, 30 a day)
-- set_vendor_cover()        one cover per vendor
-- reorder_vendor_photos()   the order families see
-- tag_vendor_photo()        the event it's from (or none)
-- remove_vendor_photo()     takes it off the page; the app then deletes its files
--
-- Only the vendor's people, and only in their own folder. They also see their
-- photos while the listing is still a draft.

create function private.can_write_vendor_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(400|1080|1600)\.webp$'
    and private.is_vendor_member(split_part(p_name, '/', 1)::uuid);
$$;

create policy "A vendor's people upload its photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-media' and private.can_write_vendor_photo(name));

create policy "A vendor's people delete its photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-media' and private.can_write_vendor_photo(name));

-- One read rule per role (two permissive ones would both run on every read):
-- everyone sees published vendors' photos, and a vendor's people also see
-- their own while the listing is a draft.
drop policy "Photos of published vendors are readable by everyone" on public.vendor_media;

create policy "Photos of published vendors are readable by everyone" on public.vendor_media
  for select to anon
  using (exists (
    select 1 from public.vendors v
    where v.id = vendor_media.vendor_id and v.status = 'published'
  ));

create policy "Published vendors' photos, and a vendor's own drafts" on public.vendor_media
  for select to authenticated
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_media.vendor_id and v.status = 'published'
    )
    or (select private.is_vendor_member(vendor_id))
  );

-- Saving ----------------------------------------------------------------------------------

create function private.add_vendor_photo(
  p_vendor_id uuid,
  p_photo_id uuid,
  p_width integer,
  p_height integer,
  p_event_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder text := p_vendor_id::text || '/' || p_photo_id::text;
  new_id uuid;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 10000
    or p_height not between 1 and 10000 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;
  if p_event_slug is not null and not exists (select 1 from public.events where slug = p_event_slug) then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  -- All three sizes must be uploaded first
  if (select count(*) from storage.objects
      where bucket_id = 'vendor-media'
        and name in (folder || '/400.webp', folder || '/1080.webp', folder || '/1600.webp')) < 3 then
    raise exception 'files_missing' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.vendor_media where storage_path = folder) then
    raise exception 'already_added' using errcode = '23505';
  end if;
  if (select count(*) from public.vendor_media where vendor_id = p_vendor_id) >= 60 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  if (select count(*) from public.vendor_media
      where vendor_id = p_vendor_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'photo_rate' using errcode = 'P0001';
  end if;

  insert into public.vendor_media (vendor_id, storage_path, width, height, event_slug, is_cover, sort_order)
  values (
    p_vendor_id, folder, p_width, p_height, p_event_slug,
    -- The first photo is the cover until they pick another
    not exists (select 1 from public.vendor_media where vendor_id = p_vendor_id and is_cover),
    coalesce((select max(sort_order) + 1 from public.vendor_media where vendor_id = p_vendor_id), 0)
  )
  returning id into new_id;
  return new_id;
end;
$$;

create function public.add_vendor_photo(
  p_vendor_id uuid,
  p_photo_id uuid,
  p_width integer,
  p_height integer,
  p_event_slug text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.add_vendor_photo(p_vendor_id, p_photo_id, p_width, p_height, p_event_slug);
$$;

comment on function public.add_vendor_photo is
  'Save a photo whose three sizes are uploaded to vendor-media/<vendor>/<photo>/{400,1080,1600}.webp. The first becomes the cover; up to 60 a vendor, 30 a day. Errors: not_allowed, invalid_size, invalid_event, files_missing, already_added, too_many_photos, photo_rate.';

-- One of the vendor's own photos, or not_allowed
create function private.own_vendor_photo(p_media_id uuid)
returns public.vendor_media
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.vendor_media;
begin
  select * into m from public.vendor_media where id = p_media_id;
  if m.id is null or not private.is_vendor_member(m.vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return m;
end;
$$;

create function private.set_vendor_cover(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.vendor_media := private.own_vendor_photo(p_media_id);
begin
  update public.vendor_media set is_cover = false where vendor_id = m.vendor_id and is_cover;
  update public.vendor_media set is_cover = true where id = m.id;
end;
$$;

create function public.set_vendor_cover(p_media_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_vendor_cover(p_media_id);
$$;

comment on function public.set_vendor_cover is 'Make one of your photos the cover. Errors: not_allowed.';

-- The vendor's photos in this order; any left out keep their place after them.
create function private.reorder_vendor_photos(p_vendor_id uuid, p_media_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_media_ids) as i (id)
    where not exists (select 1 from public.vendor_media m where m.id = i.id and m.vendor_id = p_vendor_id)
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  with ordered as (
    select m.id,
      row_number() over (
        order by coalesce(array_position(p_media_ids, m.id), 100000), m.sort_order, m.created_at
      ) - 1 as position
    from public.vendor_media m
    where m.vendor_id = p_vendor_id
  )
  update public.vendor_media m
  set sort_order = o.position
  from ordered o
  where m.id = o.id and m.sort_order is distinct from o.position;
end;
$$;

create function public.reorder_vendor_photos(p_vendor_id uuid, p_media_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.reorder_vendor_photos(p_vendor_id, p_media_ids);
$$;

comment on function public.reorder_vendor_photos is
  'Put your photos in this order (ids first, the rest after). Errors: not_allowed.';

create function private.tag_vendor_photo(p_media_id uuid, p_event_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.vendor_media := private.own_vendor_photo(p_media_id);
begin
  if p_event_slug is not null and not exists (select 1 from public.events where slug = p_event_slug) then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  update public.vendor_media set event_slug = p_event_slug where id = m.id;
end;
$$;

create function public.tag_vendor_photo(p_media_id uuid, p_event_slug text default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.tag_vendor_photo(p_media_id, p_event_slug);
$$;

comment on function public.tag_vendor_photo is
  'Say which event a photo is from (null for none). Errors: not_allowed, invalid_event.';

-- Take a photo off the page and say where its files are, for the app to
-- delete. When it was the cover, the next photo in order becomes the cover.
create function private.remove_vendor_photo(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.vendor_media := private.own_vendor_photo(p_media_id);
begin
  delete from public.vendor_media where id = m.id;
  if m.is_cover then
    update public.vendor_media set is_cover = true
    where id = (
      select id from public.vendor_media
      where vendor_id = m.vendor_id
      order by sort_order, created_at
      limit 1
    );
  end if;
  return m.storage_path;
end;
$$;

create function public.remove_vendor_photo(p_media_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.remove_vendor_photo(p_media_id);
$$;

comment on function public.remove_vendor_photo is
  'Take one of your photos off your page; returns its folder so the app deletes the files. Errors: not_allowed.';

revoke all on function
  private.can_write_vendor_photo, private.own_vendor_photo,
  private.add_vendor_photo, public.add_vendor_photo,
  private.set_vendor_cover, public.set_vendor_cover,
  private.reorder_vendor_photos, public.reorder_vendor_photos,
  private.tag_vendor_photo, public.tag_vendor_photo,
  private.remove_vendor_photo, public.remove_vendor_photo
from public;
grant execute on function
  private.can_write_vendor_photo, private.own_vendor_photo,
  private.add_vendor_photo, public.add_vendor_photo,
  private.set_vendor_cover, public.set_vendor_cover,
  private.reorder_vendor_photos, public.reorder_vendor_photos,
  private.tag_vendor_photo, public.tag_vendor_photo,
  private.remove_vendor_photo, public.remove_vendor_photo
to authenticated;
