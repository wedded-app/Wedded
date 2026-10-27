-- A family that opens Website before adding their names gets the placeholder
-- link our-wedding (our-wedding-3f9c once that's taken), because create_site()
-- names the site once (#411). When the couple's names come in later, a draft
-- that was never published takes a link made from them, the way create_site()
-- names a new site. A published site keeps its link: it may already be out.

create function private.name_draft_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  site public.wedding_sites;
  base text;
  candidate text;
begin
  select * into site from public.wedding_sites s where s.wedding_id = new.id;
  -- shortcut: a family that typed our-wedding-2027 themselves is renamed too, harmless while nobody has the link
  if not found or site.published_at is not null or site.slug !~ '^our-wedding(-[0-9a-f]{4})?$' then
    return null;
  end if;
  base := btrim(left(btrim(regexp_replace(lower(coalesce(new.title, '')), '[^a-z0-9]+', '-', 'g'), '-'), 32), '-');
  if length(base) < 3 or base = 'our-wedding' then
    return null;
  end if;
  for tries in 0..5 loop
    candidate := case when tries = 0 then base else base || '-' || substr(md5(random()::text), 1, 4) end;
    begin
      update public.wedding_sites s set slug = candidate where s.id = site.id;
      return null;
    exception when unique_violation then
      null; -- Another wedding has this link: try it with a few letters after
    end;
  end loop;
  -- Six taken in a row: keep the placeholder, the family can pick one in Settings
  return null;
end;
$$;

create trigger name_draft_site after update of title on public.weddings
  for each row when (new.title is distinct from old.title)
  execute function private.name_draft_site();
