-- Deposits through Wedded (P1, #209): a vendor asks for a deposit in chat, the
-- family pays by card through Stripe, and both see it paid. Stripe Connect with
-- standard accounts: each vendor connects their own Stripe account and is the
-- seller, so Stripe's fees come out of the vendor's payout and Wedded takes no
-- cut. Built on Stripe's test mode until the business can take live payments.
--
-- vendor_payment_accounts   A vendor's connected Stripe account and whether it
--                           can take payments. Written by the Edge Functions.
-- deposits                  One per request: amount, event, note and where it
--                           is (requested, processing, paid, failed, canceled,
--                           refunded). Both sides read their own.
-- messages kind 'deposit'   The request in the chat ({depositId}), and the
--                           system's "paid" / "refunded" updates.
-- request_deposit()         The vendor asks; cancel_deposit() takes it back.
-- Service role only, for the Edge Functions: save_payment_account(),
-- deposit_for_payment(), attach_payment_intent(), record_deposit_payment().

create table public.vendor_payment_accounts (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]{6,64}$'),
  -- Stripe says it can take card payments
  charges_enabled boolean not null default false,
  -- The vendor finished Stripe's setup pages
  details_submitted boolean not null default false,
  -- false while Wedded runs on Stripe's test mode
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vendor_payment_accounts is
  'A vendor''s connected Stripe account (standard). The vendor''s people read it; the Edge Functions write it.';

alter table public.vendor_payment_accounts enable row level security;

create policy "A vendor's people see its payment account" on public.vendor_payment_accounts
  for select to authenticated
  using ((select private.is_vendor_member(vendor_id)));

revoke all on public.vendor_payment_accounts from anon, authenticated;
grant select on public.vendor_payment_accounts to authenticated;

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  family_user_id uuid references auth.users (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  -- $1 to $25,000
  amount_cents integer not null check (amount_cents between 100 and 2500000),
  currency text not null default 'usd' check (currency = 'usd'),
  event_slug text references public.events (slug) on update cascade,
  note text check (length(btrim(note)) between 1 and 300),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'failed', 'canceled', 'refunded')),
  stripe_account_id text,
  stripe_payment_intent_id text unique,
  livemode boolean not null default false,
  paid_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deposits is
  'Deposits a vendor asked for in chat, and whether the family paid. Both sides read them; written only by request_deposit(), cancel_deposit() and the Edge Functions.';

create index deposits_conversation_idx on public.deposits (conversation_id, created_at);
create index deposits_vendor_idx on public.deposits (vendor_id, created_at desc);

alter table public.deposits enable row level security;

create policy "Both sides see their deposits" on public.deposits
  for select to authenticated
  using (
    family_user_id = (select auth.uid())
    or (select private.is_vendor_member(vendor_id))
  );

revoke all on public.deposits from anon, authenticated;
grant select on public.deposits to authenticated;

alter publication supabase_realtime add table public.deposits;

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'photo', 'quote', 'menu', 'booking', 'phone', 'voice', 'deposit'));

-- Asking and taking back ------------------------------------------------------------------

create function private.request_deposit(
  p_conversation_id uuid,
  p_amount_cents integer,
  p_event_slug text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  convo public.conversations;
  account public.vendor_payment_accounts;
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

  select * into account from public.vendor_payment_accounts where vendor_id = convo.vendor_id;
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
$$;

create function public.request_deposit(
  p_conversation_id uuid,
  p_amount_cents integer,
  p_event_slug text default null,
  p_note text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.request_deposit(p_conversation_id, p_amount_cents, p_event_slug, p_note);
$$;

comment on function public.request_deposit is
  'A vendor asks the family in a chat for a deposit ($1 to $25,000, an optional event and note), once their Stripe account can take payments. Errors: not_allowed, family_gone, family_first, payments_not_ready, invalid_amount, invalid_note, invalid_event, too_many_open, deposit_rate.';

create function private.cancel_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deposits;
begin
  select * into d from public.deposits where id = p_deposit_id;
  if d.id is null or not private.is_vendor_member(d.vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- A payment under way or done can't be taken back here (refunds go through Stripe)
  if d.status not in ('requested', 'failed') then
    raise exception 'not_cancelable' using errcode = 'P0001';
  end if;
  update public.deposits
  set status = 'canceled', canceled_at = now(), updated_at = now()
  where id = p_deposit_id;
end;
$$;

create function public.cancel_deposit(p_deposit_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_deposit(p_deposit_id);
$$;

comment on function public.cancel_deposit is
  'The vendor takes back a deposit request that isn''t being paid. Errors: not_allowed, not_cancelable.';

revoke all on function
  private.request_deposit, public.request_deposit, private.cancel_deposit, public.cancel_deposit
from public;
grant execute on function
  private.request_deposit, public.request_deposit, private.cancel_deposit, public.cancel_deposit
to authenticated;

-- For the Edge Functions (service role only) ----------------------------------------------

-- Save what Stripe says about a vendor's account.
create function public.save_payment_account(
  p_vendor_id uuid,
  p_stripe_account_id text,
  p_charges_enabled boolean,
  p_details_submitted boolean,
  p_livemode boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.vendor_payment_accounts as a
    (vendor_id, stripe_account_id, charges_enabled, details_submitted, livemode)
  values (p_vendor_id, p_stripe_account_id, p_charges_enabled, p_details_submitted, p_livemode)
  on conflict (vendor_id) do update
    set stripe_account_id = excluded.stripe_account_id,
        charges_enabled = excluded.charges_enabled,
        details_submitted = excluded.details_submitted,
        livemode = excluded.livemode,
        updated_at = now();
$$;

-- The same, found by the Stripe account (its account.updated webhook).
create function public.update_payment_account(
  p_stripe_account_id text,
  p_charges_enabled boolean,
  p_details_submitted boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vendor_payment_accounts
  set charges_enabled = p_charges_enabled,
      details_submitted = p_details_submitted,
      updated_at = now()
  where stripe_account_id = p_stripe_account_id;
$$;

-- What a family is about to pay, if they may: their own deposit, still open.
create function public.deposit_for_payment(p_deposit_id uuid, p_user_id uuid)
returns table (
  amount_cents integer,
  currency text,
  stripe_account_id text,
  stripe_payment_intent_id text,
  status text,
  vendor_name text,
  event_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.deposits;
begin
  select * into d from public.deposits where id = p_deposit_id;
  if d.id is null or d.family_user_id is distinct from p_user_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status not in ('requested', 'processing', 'failed') then
    raise exception 'not_payable' using errcode = 'P0001';
  end if;
  return query
  select d.amount_cents, d.currency, d.stripe_account_id, d.stripe_payment_intent_id, d.status,
    v.name, e.name ->> 'en'
  from public.vendors v
  left join public.events e on e.slug = d.event_slug
  where v.id = d.vendor_id;
end;
$$;

-- The payment Stripe started for a deposit.
create function public.attach_payment_intent(p_deposit_id uuid, p_payment_intent_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.deposits
  set stripe_payment_intent_id = p_payment_intent_id,
      status = 'processing',
      updated_at = now()
  where id = p_deposit_id and status in ('requested', 'processing', 'failed');
$$;

-- What Stripe's webhook says happened to a payment. "paid" and "refunded" add
-- an update to the chat; each change happens once, however often Stripe
-- repeats the event. Returns whether anything changed.
create function public.record_deposit_payment(p_payment_intent_id text, p_outcome text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deposits;
  next_status text;
begin
  if p_outcome not in ('paid', 'failed', 'refunded') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  select * into d from public.deposits where stripe_payment_intent_id = p_payment_intent_id for update;
  if d.id is null then
    return false;
  end if;
  next_status := p_outcome;
  -- Only forward: requested/processing/failed → paid or failed; paid → refunded
  if (p_outcome in ('paid', 'failed') and d.status not in ('requested', 'processing', 'failed'))
    or (p_outcome = 'refunded' and d.status <> 'paid')
    or d.status = next_status then
    return false;
  end if;

  update public.deposits
  set status = next_status,
      paid_at = case when next_status = 'paid' then now() else paid_at end,
      refunded_at = case when next_status = 'refunded' then now() else refunded_at end,
      updated_at = now()
  where id = d.id;

  if next_status in ('paid', 'refunded') then
    insert into public.messages (conversation_id, sender_user_id, sender_role, kind, data, created_at)
    values (d.conversation_id, null, 'system', 'deposit',
      jsonb_build_object('depositId', d.id, 'update', next_status), clock_timestamp());
    update public.conversations set last_message_at = clock_timestamp() where id = d.conversation_id;
  end if;
  return true;
end;
$$;

revoke all on function
  public.save_payment_account, public.update_payment_account, public.deposit_for_payment,
  public.attach_payment_intent, public.record_deposit_payment
from public, anon, authenticated;
grant execute on function
  public.save_payment_account, public.update_payment_account, public.deposit_for_payment,
  public.attach_payment_intent, public.record_deposit_payment
to service_role;
