-- Take a guest off one event (#319): for when someone was ticked for the wrong
-- event. Until now invite_to_event only added people, and removing the guest
-- or the event was the only way to undo an invite.

-- Their answer for that event goes with the invite; their other invites stay.
-- Returns how many were taken off.
create function private.uninvite_from_event(p_wedding_id uuid, p_event_slug text, p_guest_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  removed integer;
begin
  if not private.can_edit_wedding(p_wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select we.id into event_id from public.wedding_events we
  where we.wedding_id = p_wedding_id and we.event_slug = p_event_slug;
  if event_id is null then
    raise exception 'event_not_in_plan' using errcode = 'P0002';
  end if;
  -- An invite to this wedding's event is only ever this wedding's guest
  delete from public.guest_invites
  where wedding_event_id = event_id and guest_id = any(coalesce(p_guest_ids, '{}'));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create function public.uninvite_from_event(p_wedding_id uuid, p_event_slug text, p_guest_ids uuid[])
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.uninvite_from_event(p_wedding_id, p_event_slug, p_guest_ids);
$$;

comment on function public.uninvite_from_event is
  'Owner and editors: take guests off one event, with their answer for it. Returns how many were taken off. Errors: not_allowed, event_not_in_plan.';

revoke all on function private.uninvite_from_event from public;
grant execute on function private.uninvite_from_event to authenticated;
revoke all on function public.uninvite_from_event from public;
grant execute on function public.uninvite_from_event to authenticated;
