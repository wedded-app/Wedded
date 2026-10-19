-- Payout accounts, to the database design (payout_accounts): a vendor's Stripe
-- connected account, where their deposits land, takes the design's name, and
-- so do the server's two functions that save what Stripe says about it.
--
-- Kept from today though the design leaves them out: details_submitted (has
-- the vendor finished Stripe's form) and livemode (test or live keys). The
-- deposits keep their payment intents, the event, who asked and when it was
-- canceled; a deposit's booking comes with booking from a deposit.

alter table public.vendor_payment_accounts rename to payout_accounts;
alter table public.payout_accounts rename constraint vendor_payment_accounts_pkey to payout_accounts_pkey;
alter table public.payout_accounts
  rename constraint vendor_payment_accounts_stripe_account_id_key to payout_accounts_stripe_account_id_key;
alter table public.payout_accounts
  rename constraint vendor_payment_accounts_stripe_account_id_check to payout_accounts_stripe_account_id_check;
alter table public.payout_accounts
  rename constraint vendor_payment_accounts_vendor_id_fkey to payout_accounts_vendor_id_fkey;
alter policy "A vendor's people see its payment account" on public.payout_accounts
  rename to "A vendor's people see its payout account";

alter function public.save_payment_account(uuid, text, boolean, boolean, boolean) rename to save_payout_account;
alter function public.update_payment_account(text, boolean, boolean) rename to update_payout_account;

-- Save what Stripe says about a vendor's account
CREATE OR REPLACE FUNCTION public.save_payout_account(p_vendor_id uuid, p_stripe_account_id text, p_charges_enabled boolean, p_details_submitted boolean, p_livemode boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.payout_accounts as a
    (vendor_id, stripe_account_id, charges_enabled, details_submitted, livemode)
  values (p_vendor_id, p_stripe_account_id, p_charges_enabled, p_details_submitted, p_livemode)
  on conflict (vendor_id) do update
    set stripe_account_id = excluded.stripe_account_id,
        charges_enabled = excluded.charges_enabled,
        details_submitted = excluded.details_submitted,
        livemode = excluded.livemode,
        updated_at = now();
$function$
;

-- The same, found by the Stripe account (its account.updated webhook)
CREATE OR REPLACE FUNCTION public.update_payout_account(p_stripe_account_id text, p_charges_enabled boolean, p_details_submitted boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.payout_accounts
  set charges_enabled = p_charges_enabled,
      details_submitted = p_details_submitted,
      updated_at = now()
  where stripe_account_id = p_stripe_account_id;
$function$
;

-- Asking for a deposit needs the vendor's payout account ready
CREATE OR REPLACE FUNCTION private.request_deposit(p_conversation_id uuid, p_amount_cents integer, p_event_slug text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := (select auth.uid());
  convo public.conversations;
  account public.payout_accounts;
  new_id uuid;
begin
  select * into convo from public.conversations where id = p_conversation_id;
  if convo.id is null or caller is null or not private.is_vendor_member(convo.vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if convo.family_user_id is null then
    raise exception 'family_gone' using errcode = 'P0002';
  end if;
  -- The same rule as chat: vendors only reply
  if not exists (
    select 1 from public.messages
    where conversation_id = p_conversation_id and sender_role = 'family'
  ) then
    raise exception 'family_first' using errcode = '42501';
  end if;

  select * into account from public.payout_accounts where vendor_id = convo.vendor_id;
  if account.vendor_id is null or not account.charges_enabled then
    raise exception 'payments_not_ready' using errcode = 'P0001';
  end if;

  if p_amount_cents is null or p_amount_cents not between 100 and 2500000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  p_note := nullif(btrim(p_note), '');
  if p_note is not null and length(p_note) > 300 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if p_event_slug is not null and not exists (select 1 from public.events where slug = p_event_slug) then
    raise exception 'invalid_event' using errcode = '22023';
  end if;

  if (select count(*) from public.deposits
      where conversation_id = p_conversation_id and status in ('requested', 'processing', 'failed')) >= 3 then
    raise exception 'too_many_open' using errcode = 'P0001';
  end if;
  if (select count(*) from public.deposits
      where vendor_id = convo.vendor_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'deposit_rate' using errcode = 'P0001';
  end if;

  insert into public.deposits (
    conversation_id, vendor_id, family_user_id, requested_by, amount_cents, event_slug, note,
    stripe_account_id, livemode
  )
  values (
    p_conversation_id, convo.vendor_id, convo.family_user_id, caller, p_amount_cents, p_event_slug,
    p_note, account.stripe_account_id, account.livemode
  )
  returning id into new_id;

  insert into public.messages (conversation_id, sender_user_id, sender_role, kind, body, data, created_at)
  values (p_conversation_id, caller, 'vendor', 'deposit', p_note,
    jsonb_build_object('depositId', new_id), clock_timestamp());
  update public.conversations
  set last_message_at = clock_timestamp(), vendor_read_at = clock_timestamp()
  where id = p_conversation_id;

  return new_id;
end;
$function$
;
