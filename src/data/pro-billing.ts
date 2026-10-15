/** Wedded Pro billing (#220). Open the returned Stripe URL on the website.
 * On return, refresh so Stripe and the vendor's Pro status are in step.
 */
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { requestKeys } from './requests';

export type ProBillingAction = 'checkout' | 'portal' | 'refresh';
export type ProBillingResult = { url?: string; status: 'pro' | 'free' };
export type ProBillingProblem =
  'notSetUp' | 'notAllowed' | 'signIn' | 'alreadySubscribed' | 'noCustomer' | 'offline' | 'failed';
export class ProBillingError extends Error {
  constructor(readonly problem: ProBillingProblem) {
    super(problem);
  }
}
export function proBillingProblem(error: unknown): ProBillingProblem {
  if (error instanceof ProBillingError) return error.problem;
  if (error instanceof FunctionsFetchError) return 'offline';
  return 'failed';
}
/** Server checks membership; price, customer and redirect URLs never come from the browser. */
export async function callProBilling(
  vendorId: string,
  action: ProBillingAction,
): Promise<ProBillingResult> {
  const { data, error } = await supabase.functions.invoke<ProBillingResult>('pro-billing', {
    body: { vendorId, action },
  });
  if (error instanceof FunctionsFetchError) throw new ProBillingError('offline');
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body: { error?: string } = await response.json().catch(() => ({}));
    if (response.status === 401) throw new ProBillingError('signIn');
    if (response.status === 403) throw new ProBillingError('notAllowed');
    if (response.status === 503 || body.error === 'not_set_up')
      throw new ProBillingError('notSetUp');
    if (body.error === 'already_subscribed') throw new ProBillingError('alreadySubscribed');
    if (body.error === 'no_customer') throw new ProBillingError('noCustomer');
    throw new ProBillingError('failed');
  }
  if (error || !data || !['pro', 'free'].includes(data.status)) throw new ProBillingError('failed');
  if (action !== 'refresh') {
    try {
      const url = new URL(data.url ?? '');
      const host = action === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com';
      if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password)
        throw new Error('invalid_url');
    } catch {
      throw new ProBillingError('failed');
    }
  }
  return data;
}
/** Checkout, manage billing, or refresh after returning from Stripe. */
export function useProBilling(vendorId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: ProBillingAction) => callProBilling(vendorId, action),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: requestKeys.pro(vendorId) });
      void client.invalidateQueries({ queryKey: [...requestKeys.all, 'looking', vendorId] });
      void client.invalidateQueries({ queryKey: requestKeys.summary(vendorId) });
    },
  });
}
