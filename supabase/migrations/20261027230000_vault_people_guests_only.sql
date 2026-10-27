-- Who's in the Memory Vault (#351) lists only guests who joined by the link.
-- Someone who joined that way and was later added to the wedding plan kept
-- their vault_guests row, so they showed with a Remove that did nothing: the
-- plan gives them the vault anyway (private.vault_role checks it first).

create or replace function private.vault_people(p_vault_id uuid)
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
  join public.memory_vaults v on v.id = g.vault_id
  left join public.profiles p on p.id = g.user_id
  where g.vault_id = p_vault_id
    and private.vault_role(p_vault_id) = 'couple'
    and not exists (
      select 1 from public.wedding_members m
      where m.wedding_id = v.wedding_id and m.user_id = g.user_id
    )
  order by g.joined_at desc, g.user_id;
$$;
