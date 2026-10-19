-- The vendor listings restructure (#317) replaced vendors.city with
-- base_city_slug, a link to the city, so the Memory Vault's "vendors who made
-- this day" (#306) shows that city's name instead. Same columns as before.
create or replace function private.vault_vendors(p_vault_id uuid)
returns table (
  vendor_id uuid,
  slug text,
  name text,
  city text,
  is_sample boolean,
  category_slugs text[],
  event_slugs text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vd.id,
    vd.slug,
    vd.name,
    c.name,
    vd.is_sample,
    array_agg(distinct s.category_slug order by s.category_slug),
    array_agg(distinct we.event_slug order by we.event_slug)
  from public.memory_vaults v
  join public.wedding_events we on we.wedding_id = v.wedding_id
  join public.wedding_slots s on s.wedding_event_id = we.id
  join public.bookings b on b.slot_id = s.id and b.status in ('confirmed', 'completed')
  join public.vendors vd on vd.id = b.vendor_id and vd.status = 'published'
  join public.cities c on c.slug = vd.base_city_slug
  where v.id = p_vault_id
    and case private.vault_role(v.id)
      when 'couple' then true
      when 'family' then true
      when 'guest' then v.show_vendors
      else false
    end
  group by vd.id, vd.slug, vd.name, c.name, vd.is_sample
  order by vd.name, vd.id;
$$;
