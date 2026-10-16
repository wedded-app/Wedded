-- Once Stripe confirms a subscription, never reuse its finished Checkout session.
create or replace function public.save_pro_subscription(
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
      synced_at=p_observed_at, updated_at=now(),
      checkout_attempt=case when p_stripe_subscription_id is not null then null else checkout_attempt end,
      checkout_expires_at=case when p_stripe_subscription_id is not null then null else checkout_expires_at end
  where stripe_customer_id=p_stripe_customer_id and livemode=false
    and (synced_at is null or synced_at <= p_observed_at)
  returning vendor_id into saved;
  return saved;
end;
$$;
