-- Chat, to the database design (group_invites, conversations): a family
-- chat's join link is kept only as a hash of its token, like the wedding's
-- and the Memory Vault's (links already sent keep working), and a
-- conversation's family_name is family_label, the short name the vendor sees
-- ("Harjit K."). The app's chat list, alerts and links don't change.
--
-- message_reactions.reaction keeps its six names (heart, thumbs_up, laugh,
-- wow, sad, pray) instead of the design's free emoji, so only what the picker
-- offers can be saved.

alter table public.group_invites add column token_hash text;
update public.group_invites set token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
alter table public.group_invites
  alter column token_hash set not null,
  add constraint group_invites_token_hash_key unique (token_hash),
  drop column token;

comment on column public.group_invites.token_hash is
  'sha256 of the link''s token, which is shown once when the link is made and never stored.';

alter table public.conversations rename column family_name to family_label;
comment on column public.conversations.family_label is
  'The family''s short name as the vendor sees it ("Harjit K."); cleared when the account is deleted.';

-- A join link is made once and kept only as its hash
CREATE OR REPLACE FUNCTION private.create_group_invite(p_thread_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not private.can_manage_group(p_thread_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.group_invites
      where thread_id = p_thread_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;
  insert into public.group_invites (thread_id, created_by, token_hash)
  values (p_thread_id, (select auth.uid()), encode(sha256(convert_to(new_token, 'UTF8')), 'hex'));
  return new_token;
end;
$function$
;

-- Links are looked up by their hash
CREATE OR REPLACE FUNCTION private.group_invite_preview(p_token text)
 RETURNS TABLE(status text, thread_name text, wedding_title text, inviter_name text, member_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  inv public.group_invites;
begin
  select * into inv from public.group_invites i where i.token_hash = encode(sha256(convert_to(lower(btrim(p_token)), 'UTF8')), 'hex');
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::integer;
    return;
  end if;
  return query
  select
    case
      when inv.revoked_at is not null then 'revoked'
      when inv.expires_at <= now() then 'expired'
      when inv.uses >= inv.max_uses then 'used_up'
      else 'valid'
    end,
    t.name,
    w.title,
    -- First name only
    nullif(split_part(btrim(p.full_name), ' ', 1), ''),
    (select count(*)::integer from public.group_members m where m.thread_id = t.id)
  from public.group_threads t
  join public.weddings w on w.id = t.wedding_id
  left join public.profiles p on p.id = inv.created_by
  where t.id = inv.thread_id;
end;
$function$
;

-- when previewed and when joined
CREATE OR REPLACE FUNCTION private.accept_group_invite(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  inv public.group_invites;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into inv from public.group_invites i
  where i.token_hash = encode(sha256(convert_to(lower(btrim(p_token)), 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.group_members where thread_id = inv.thread_id and user_id = caller) then
    return inv.thread_id;
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  elsif inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  elsif inv.uses >= inv.max_uses then
    raise exception 'invite_used_up' using errcode = 'P0001';
  end if;

  perform private.join_group(inv.thread_id, array[caller], inv.created_by);
  update public.group_invites set uses = uses + 1 where id = inv.id;
  return inv.thread_id;
end;
$function$
;

-- A family's label on a new chat
CREATE OR REPLACE FUNCTION private.inquiry_to_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  conversation uuid;
begin
  if new.user_id is null then
    return new;
  end if;
  insert into public.conversations as c (vendor_id, family_user_id, family_label, family_read_at)
  values (new.vendor_id, new.user_id, private.short_name(new.sender_name), now())
  on conflict (vendor_id, family_user_id) do update
    set last_message_at = clock_timestamp(), family_read_at = clock_timestamp()
  returning c.id into conversation;

  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, inquiry_id, created_at)
  values (conversation, new.user_id, 'family', 'booking', new.message,
    jsonb_strip_nulls(jsonb_build_object(
      'eventSlugs', to_jsonb(private.inquiry_event_slugs(new.id)),
      'eventDate', new.event_date,
      'startTime', new.start_time,
      'guestBand', new.guest_band,
      'location', private.inquiry_place(new.city_slug, new.venue_id, new.venue_text),
      'details', new.answers || case when new.kind = 'tour' then '{"tour": true}'::jsonb else '{}'::jsonb end
    )),
    new.id, clock_timestamp());
  return new;
end;
$function$
;

-- from an inquiry, a Message tap
CREATE OR REPLACE FUNCTION private.start_conversation(p_vendor_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  conversation uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'needs_profile' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vendors where id = p_vendor_id and status = 'published') then
    raise exception 'vendor_not_found' using errcode = 'P0002';
  end if;

  select id into conversation from public.conversations
  where vendor_id = p_vendor_id and family_user_id = caller;
  if conversation is not null then
    return conversation;
  end if;

  if (select count(*) from public.conversations
      where family_user_id = caller and created_at > now() - interval '1 day') >= 30 then
    raise exception 'conversation_rate' using errcode = 'P0001';
  end if;

  insert into public.conversations (vendor_id, family_user_id, family_label, family_read_at)
  values (p_vendor_id, caller,
    private.short_name((select full_name from public.profiles where id = caller)), now())
  returning id into conversation;
  return conversation;
end;
$function$
;

-- or an accepted proposal
CREATE OR REPLACE FUNCTION private.answer_proposal(p_proposal_id uuid, p_accept boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  rp public.request_proposals;
  r public.wedding_requests;
  convo uuid;
begin
  select * into rp from public.request_proposals where id = p_proposal_id for update;
  select * into r from public.wedding_requests where id = rp.request_id;
  if rp.id is null or caller is null or not private.can_edit_wedding(r.wedding_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if rp.status <> 'sent' then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.request_proposals set status = 'declined', answered_at = now() where id = rp.id;
    return null;
  end if;

  -- The family's chat with this vendor (one per family and vendor)
  select id into convo from public.conversations
  where vendor_id = rp.vendor_id and family_user_id = caller;
  if convo is null then
    insert into public.conversations (vendor_id, family_user_id, family_label)
    values (rp.vendor_id, caller,
      (select private.short_name(full_name) from public.profiles where id = caller))
    returning id into convo;
  end if;

  -- The proposal as the vendor sent it, then the family's yes: the family has
  -- now written, so the vendor can reply under the usual chat rules
  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, created_at)
  values
    (convo, rp.sent_by, 'vendor', 'proposal', rp.note,
      jsonb_build_object('proposalId', rp.id, 'requestId', r.id), clock_timestamp()),
    (convo, caller, 'family', 'proposal', null,
      jsonb_build_object('proposalId', rp.id, 'requestId', r.id, 'update', 'accepted'),
      clock_timestamp() + interval '1 millisecond');
  update public.conversations
  set last_message_at = clock_timestamp(), family_read_at = clock_timestamp()
  where id = convo;

  update public.request_proposals
  set status = 'accepted', answered_at = now(), conversation_id = convo
  where id = rp.id;
  return convo;
end;
$function$
;

-- and gone with the account
CREATE OR REPLACE FUNCTION private.scrub_conversation_family()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.family_user_id is null and old.family_user_id is not null then
    new.family_label := null;
  end if;
  return new;
end;
$function$
;

-- The chat list, the email alerts and the push alerts keep their shapes
CREATE OR REPLACE FUNCTION private.my_conversations()
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
    mine.family_label,
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
$function$
;

CREATE OR REPLACE FUNCTION public.claim_chat_notifications(p_quiet_minutes integer DEFAULT 3)
 RETURNS TABLE(conversation_id uuid, notify_side text, recipients text[], vendor_has_account boolean, vendor_name text, vendor_slug text, family_name text, unread_count integer, last_body text, last_kind text, notified_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  quiet interval := make_interval(mins => greatest(p_quiet_minutes, 0));
  r record;
  stamp timestamptz := now();
  side text;
  emails text[];
  has_account boolean;
begin
  for r in
    select c.id, c.vendor_id, c.family_user_id, c.family_label as family_name, v.name as vendor_name, v.slug as vendor_slug,
      exists (
        select 1 from public.messages m
        where m.conversation_id = c.id and m.sender_role = 'family'
          and m.created_at > coalesce(c.vendor_read_at, '-infinity')
          and m.created_at > coalesce(c.vendor_notified_at, '-infinity')
          and m.created_at < now() - quiet
      ) as vendor_due,
      c.family_user_id is not null and exists (
        select 1 from public.messages m
        where m.conversation_id = c.id and m.sender_role = 'vendor'
          and m.created_at > coalesce(c.family_read_at, '-infinity')
          and m.created_at > coalesce(c.family_notified_at, '-infinity')
          and m.created_at < now() - quiet
      ) as family_due
    from public.conversations c
    join public.vendors v on v.id = c.vendor_id
    where c.last_message_at > now() - interval '14 days'
      and c.last_message_at < now() - quiet
    for update of c skip locked
  loop
    foreach side in array array['vendor', 'family'] loop
      continue when (side = 'vendor' and not r.vendor_due) or (side = 'family' and not r.family_due);

      if side = 'vendor' then
        select coalesce(array_agg(u.email::text order by u.email), '{}') into emails
        from public.vendor_members vm
        join auth.users u on u.id = vm.user_id
        where vm.vendor_id = r.vendor_id and u.email is not null;
        has_account := cardinality(emails) > 0;
        if not has_account then
          select coalesce(array_agg(p.email), '{}') into emails
          from public.vendor_private p
          where p.vendor_id = r.vendor_id and p.email is not null and p.checks_email is not false;
        end if;
        update public.conversations set vendor_notified_at = stamp where id = r.id;
      else
        select coalesce(array_agg(u.email::text), '{}') into emails
        from auth.users u where u.id = r.family_user_id and u.email is not null;
        has_account := true;
        update public.conversations set family_notified_at = stamp where id = r.id;
      end if;

      return query
      select r.id, side, emails, has_account, r.vendor_name, r.vendor_slug, r.family_name,
        (select count(*)::integer from public.messages m
         where m.conversation_id = r.id
           and m.sender_role = case when side = 'vendor' then 'family' else 'vendor' end
           and m.created_at > coalesce(
             (select case when side = 'vendor' then c.vendor_read_at else c.family_read_at end
              from public.conversations c where c.id = r.id), '-infinity')),
        last.body, last.kind, stamp
      from (
        select m.body, m.kind from public.messages m
        where m.conversation_id = r.id
          and m.sender_role = case when side = 'vendor' then 'family' else 'vendor' end
        order by m.created_at desc limit 1
      ) last;
    end loop;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_push_messages()
 RETURNS TABLE(message_id uuid, conversation_id uuid, recipient_side text, tokens text[], title text, kind text, body text, data jsonb, event_names text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.messages
  set pushed_at = now()
  where pushed_at is null and created_at < now() - interval '10 minutes';

  return query
  with claimed as (
    update public.messages m
    set pushed_at = now()
    where m.id in (
      select id from public.messages
      where pushed_at is null
      order by created_at
      limit 200
      for update skip locked
    )
    returning m.id, m.conversation_id, m.sender_user_id, m.sender_role, m.kind, m.body, m.data
  )
  select
    c.id,
    c.conversation_id,
    case when c.sender_role = 'vendor' then 'family' else 'vendor' end,
    coalesce((
      select array_agg(t.push_token order by t.last_seen_at desc)
      from public.devices t
      where t.user_id is distinct from c.sender_user_id
        and (
          (c.sender_role = 'vendor' and t.user_id = conv.family_user_id)
          or (c.sender_role <> 'vendor' and t.user_id in (
            select vm.user_id from public.vendor_members vm where vm.vendor_id = conv.vendor_id))
        )
    ), '{}'),
    -- To the vendor: the family's short name; to the family: the business
    case when c.sender_role = 'vendor' then v.name else coalesce(conv.family_label, 'A family') end,
    c.kind,
    c.body,
    -- Never the phone number itself on a lock screen
    case when c.kind = 'phone' then '{}'::jsonb else c.data end,
    case when c.kind = 'booking' then (
      select coalesce(array_agg(coalesce(e.name ->> 'en', s.slug) order by s.n), '{}')
      from jsonb_array_elements_text(coalesce(c.data -> 'eventSlugs', '[]'::jsonb))
        with ordinality as s (slug, n)
      left join public.events e on e.slug = s.slug
    ) else '{}' end
  from claimed c
  join public.conversations conv on conv.id = c.conversation_id
  join public.vendors v on v.id = conv.vendor_id;
end;
$function$
;
