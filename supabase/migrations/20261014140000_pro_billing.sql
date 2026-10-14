-- Wedded Pro billing (#220), Stripe test mode. Only the service role writes.
alter table public.vendor_subscriptions
  add constraint vendor_subscriptions_customer_unique unique (stripe_customer_id),
  add column synced_at timestamptz,
  add column checkout_attempt uuid,
  add column checkout_expires_at timestamptz;
alter table public.vendor_subscriptions drop constraint vendor_subscriptions_status_check;
alter table public.vendor_subscriptions add constraint vendor_subscriptions_status_check
  check (status in ('active','trialing','past_due','canceled','incomplete','unpaid','incomplete_expired','paused'));

create function public.save_pro_customer(p_vendor_id uuid, p_stripe_customer_id text, p_livemode boolean)
returns text language plpgsql security invoker set search_path = '' as $$
declare saved text;
begin
  if p_stripe_customer_id is null or p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'invalid_customer' using errcode = '22023';
  end if;
  if p_livemode is distinct from false then
    raise exception 'test_mode_only' using errcode = '22023';
  end if;
  insert into public.vendor_subscriptions(vendor_id,status,stripe_customer_id,livemode)
  values(p_vendor_id,'incomplete',p_stripe_customer_id,false)
  on conflict(vendor_id) do update
    set stripe_customer_id=coalesce(public.vendor_subscriptions.stripe_customer_id,excluded.stripe_customer_id),
        updated_at=now()
  returning stripe_customer_id into saved;
  return saved;
end;
$$;
comment on function public.save_pro_customer is
  'Service role only: save the vendor customer once; return the existing customer on a retry. Test mode only.';

create function public.save_pro_subscription(
  p_stripe_customer_id text, p_status text, p_stripe_subscription_id text,
  p_current_period_end timestamptz, p_cancel_at_period_end boolean, p_observed_at timestamptz
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved uuid;
begin
  if p_status is null or p_status not in ('active','trialing','past_due','canceled','incomplete','unpaid','incomplete_expired','paused') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_observed_at is null or (p_stripe_subscription_id is not null and p_stripe_subscription_id !~ '^sub_[A-Za-z0-9]+$') then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;
  update public.vendor_subscriptions
  set status=p_status, stripe_subscription_id=p_stripe_subscription_id,
      current_period_end=p_current_period_end, cancel_at_period_end=coalesce(p_cancel_at_period_end,false),
      synced_at=p_observed_at, updated_at=now()
  where stripe_customer_id=p_stripe_customer_id and livemode=false
    and (synced_at is null or synced_at <= p_observed_at)
  returning vendor_id into saved;
  return saved;
end;
$$;
comment on function public.save_pro_subscription is
  'Service role only: save current Stripe state fetched after p_observed_at. An older overlapping refresh cannot overwrite a newer one.';

create function public.claim_pro_checkout(p_vendor_id uuid)
returns table(attempt_id uuid, expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare s public.vendor_subscriptions;
begin
  select * into s from public.vendor_subscriptions where vendor_id=p_vendor_id for update;
  if s.vendor_id is null or s.stripe_customer_id is null or s.livemode then
    raise exception 'not_ready' using errcode = 'P0001';
  end if;
  if s.checkout_attempt is null or s.checkout_expires_at <= now() then
    update public.vendor_subscriptions
    set checkout_attempt=gen_random_uuid(), checkout_expires_at=date_trunc('second',now())+interval '1 hour'
    where vendor_id=p_vendor_id returning * into s;
  end if;
  return query select s.checkout_attempt,s.checkout_expires_at;
end;
$$;
comment on function public.claim_pro_checkout is
  'Service role only: share one Stripe idempotency key and expiry across concurrent Checkout requests and retries.';

revoke all on function public.save_pro_customer, public.save_pro_subscription, public.claim_pro_checkout
  from public, anon, authenticated;
grant execute on function public.save_pro_customer, public.save_pro_subscription, public.claim_pro_checkout
  to service_role;
grant insert,update on public.vendor_subscriptions to service_role;
