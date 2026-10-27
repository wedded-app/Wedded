-- Who's in the Memory Vault (#351): the couple sees everyone who joined by
-- the link, to take someone out with remove_vault_guest. Profiles are private,
-- so names come through here, first name only, as the vault's items do.

create function private.vault_people(p_vault_id uuid)
returns table (user_id uuid, first_name text, joined_at timestamptz, item_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.user_id,
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    g.joined_at,
    (select count(*)::integer from public.vault_items i
     where i.vault_id = g.vault_id and i.user_id = g.user_id)
  from public.vault_guests g
  left join public.profiles p on p.id = g.user_id
  where g.vault_id = p_vault_id
    and private.vault_role(p_vault_id) = 'couple'
  order by g.joined_at desc, g.user_id;
$$;

create function public.vault_people(p_vault_id uuid)
returns table (user_id uuid, first_name text, joined_at timestamptz, item_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vault_people(p_vault_id);
$$;

comment on function public.vault_people is
  'Who joined a Memory Vault by its link: first name, when they joined and how many photos and videos they added, newest first. The couple only; anyone else gets no rows.';

revoke all on function private.vault_people from public;
grant execute on function private.vault_people to authenticated;
revoke all on function public.vault_people from public, anon, authenticated;
grant execute on function public.vault_people to authenticated;
