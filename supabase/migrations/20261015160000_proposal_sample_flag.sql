-- Proposals from demo sample vendors need the "Sample" tag on the family's
-- comparison too. request_proposals_for gains a last column, vendor_is_sample.

drop function public.request_proposals_for(p_request_id uuid);
drop function private.request_proposals_for(p_request_id uuid);

create function private.request_proposals_for(p_request_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_slug text, vendor_name text, vendor_city text, cover_path text, founding_number integer, price_cents integer, price_unit text, note text, menu_id uuid, reel_id uuid, status text, conversation_id uuid, created_at timestamp with time zone, vendor_is_sample boolean)
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
    rp.status, rp.conversation_id, rp.created_at, v.is_sample
  from public.request_proposals rp
  join public.vendors v on v.id = rp.vendor_id
  where rp.request_id = r.id and rp.status <> 'withdrawn'
  order by (rp.status = 'accepted') desc, rp.created_at;
end;
$function$;
revoke all on function private.request_proposals_for(p_request_id uuid) from public;
grant execute on function private.request_proposals_for(p_request_id uuid) to authenticated;

create function public.request_proposals_for(p_request_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_slug text, vendor_name text, vendor_city text, cover_path text, founding_number integer, price_cents integer, price_unit text, note text, menu_id uuid, reel_id uuid, status text, conversation_id uuid, created_at timestamp with time zone, vendor_is_sample boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.request_proposals_for(p_request_id);
$function$;
comment on function public.request_proposals_for(p_request_id uuid) is
  'The proposals on a request, for its wedding''s members: the vendor (name, town, cover photo, founding number, whether it is a demo sample), price, note, menu or reel, and status. Errors: not_allowed.';
revoke all on function public.request_proposals_for(p_request_id uuid) from public;
grant execute on function public.request_proposals_for(p_request_id uuid) to anon, authenticated, service_role;
