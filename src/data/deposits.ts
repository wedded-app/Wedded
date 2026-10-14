/**
 * Deposits through Wedded (P1, #209): a vendor asks for a deposit in chat and
 * the family pays by card through Stripe, on the vendor's own connected
 * Stripe account (see the deposits migration and the stripe-connect,
 * pay-deposit and stripe-webhook Edge Functions). Until Stripe's keys are set,
 * the functions answer 'notSetUp' and the app says deposits are coming soon.
 */
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import { chatKeys } from './chat';

export const depositKeys = {
  all: ['deposits'] as const,
  conversation: (conversationId: string) =>
    [...depositKeys.all, 'conversation', conversationId] as const,
  account: (vendorId: string) => [...depositKeys.all, 'account', vendorId] as const,
};

// Money ------------------------------------------------------------------------------------

/** The most a deposit can be, in cents: $25,000. The least is $1. */
export const MAX_DEPOSIT_CENTS = 2_500_000;
export const MIN_DEPOSIT_CENTS = 100;

/**
 * What someone typed as dollars ("500", "$1,250.50") in cents, or null when it
 * isn't an amount between $1 and $25,000.
 */
export function dollarsToCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents >= MIN_DEPOSIT_CENTS && cents <= MAX_DEPOSIT_CENTS ? cents : null;
}

/** "$500", or "$1,250.50" when there are cents. */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Deposits in a chat -----------------------------------------------------------------------

export type DepositStatus =
  'requested' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded';

export type Deposit = {
  id: string;
  conversationId: string;
  vendorId: string;
  amountCents: number;
  eventSlug: string | null;
  note: string | null;
  status: DepositStatus;
  createdAt: string;
  paidAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
};

type DepositRow = {
  id: string;
  conversation_id: string;
  vendor_id: string;
  amount_cents: number;
  event_slug: string | null;
  note: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
};

const STATUSES: DepositStatus[] = [
  'requested',
  'processing',
  'paid',
  'failed',
  'canceled',
  'refunded',
];

export function toDeposit(row: DepositRow): Deposit {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    vendorId: row.vendor_id,
    amountCents: row.amount_cents,
    eventSlug: row.event_slug,
    note: row.note,
    status: STATUSES.find((s) => s === row.status) ?? 'requested',
    createdAt: row.created_at,
    paidAt: row.paid_at,
    canceledAt: row.canceled_at,
    refundedAt: row.refunded_at,
  };
}

/** The family can (still) pay it: asked for, or a payment started or failed. */
export function canPay(deposit: Pick<Deposit, 'status'>): boolean {
  return ['requested', 'processing', 'failed'].includes(deposit.status);
}

/** The vendor can take it back: nobody is paying it and it isn't paid. */
export function canCancel(deposit: Pick<Deposit, 'status'>): boolean {
  return deposit.status === 'requested' || deposit.status === 'failed';
}

/**
 * Every deposit in a chat by id, kept live: a 'deposit' message's
 * data.depositId finds its card here, and the card changes as it's paid.
 */
export function useDeposits(conversationId: string) {
  const queryClient = useQueryClient();
  const key = depositKeys.conversation(conversationId);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deposits')
        .select(
          'id, conversation_id, vendor_id, amount_cents, event_slug, note, status, created_at, paid_at, canceled_at, refunded_at',
        )
        .eq('conversation_id', conversationId)
        .order('created_at');
      if (error) throw error;
      return new Map((data as DepositRow[]).map((row) => [row.id, toDeposit(row)]));
    },
    enabled: conversationId.length > 0,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`deposits:${conversationId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposits',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // key is rebuilt from conversationId each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient]);

  return query;
}

export type DepositRequest = {
  amountCents: number;
  eventSlug?: string | null;
  note?: string | null;
};

/** The vendor asks for a deposit in this chat; it appears as a 'deposit' message. */
export function useRequestDeposit(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: DepositRequest) => {
      const { data, error } = await supabase.rpc('request_deposit', {
        p_conversation_id: conversationId,
        p_amount_cents: request.amountCents,
        p_event_slug: request.eventSlug ?? undefined,
        p_note: request.note?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: depositKeys.conversation(conversationId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    },
  });
}

/** The vendor takes back a request nobody is paying. */
export function useCancelDeposit(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (depositId: string) => {
      const { error } = await supabase.rpc('cancel_deposit', { p_deposit_id: depositId });
      if (error) throw new Error(error.message);
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: depositKeys.conversation(conversationId) }),
  });
}

export type DepositProblem =
  | 'notSetUp'
  | 'notReady'
  | 'familyFirst'
  | 'invalidAmount'
  | 'tooMany'
  | 'rate'
  | 'notPayable'
  | 'notAllowed'
  | 'offline'
  | 'failed';

/** A refused request, cancel or payment, in terms a screen can word. */
export function depositProblem(error: unknown): DepositProblem {
  if (error instanceof DepositFunctionError) return error.problem;
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('payments_not_ready')) return 'notReady';
  if (message.includes('family_first')) return 'familyFirst';
  if (message.includes('invalid_amount')) return 'invalidAmount';
  if (message.includes('too_many_open')) return 'tooMany';
  if (message.includes('deposit_rate')) return 'rate';
  if (message.includes('not_cancelable') || message.includes('not_payable')) return 'notPayable';
  if (message.includes('not_allowed')) return 'notAllowed';
  return 'failed';
}

class DepositFunctionError extends Error {
  constructor(readonly problem: DepositProblem) {
    super(problem);
  }
}

/** Calls one of the deposit Edge Functions, turning its refusals into problems. */
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error && data) return data;
  if (error instanceof FunctionsFetchError) throw new DepositFunctionError('offline');
  if (!(error instanceof FunctionsHttpError)) throw new DepositFunctionError('failed');
  const response = error.context as Response;
  const answer: { error?: string } = await response.json().catch(() => ({}));
  if (response.status === 503 || answer.error === 'not_set_up') {
    throw new DepositFunctionError('notSetUp');
  }
  if (response.status === 403) throw new DepositFunctionError('notAllowed');
  if (response.status === 409) throw new DepositFunctionError('notPayable');
  throw new DepositFunctionError('failed');
}

// Paying -----------------------------------------------------------------------------------

export type DepositPayment =
  | {
      kind: 'pay';
      /** For Stripe's payment sheet: initStripe({ publishableKey, stripeAccountId }) then initPaymentSheet({ paymentIntentClientSecret }) */
      clientSecret: string;
      publishableKey: string;
      stripeAccountId: string;
      amountCents: number;
      vendorName: string;
    }
  | { kind: 'alreadyPaid' };

/**
 * The family starts paying: what Stripe's payment sheet needs, on the vendor's
 * account. The deposit turns 'paid' (live) once Stripe confirms it.
 */
export function useStartDepositPayment(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (depositId: string): Promise<DepositPayment> => {
      const data = await callFunction<
        | {
            clientSecret: string;
            publishableKey: string;
            stripeAccountId: string;
            amountCents: number;
            vendorName: string;
          }
        | { alreadyPaid: true }
      >('pay-deposit', { depositId });
      return 'alreadyPaid' in data ? { kind: 'alreadyPaid' } : { kind: 'pay', ...data };
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: depositKeys.conversation(conversationId) }),
  });
}

// The vendor's Stripe account --------------------------------------------------------------

export type PaymentAccountStatus = 'none' | 'pending' | 'ready';

/** Whether families can pay this vendor: not connected, setup unfinished, or ready. */
export function usePaymentAccount(vendorId: string) {
  return useQuery({
    queryKey: depositKeys.account(vendorId),
    queryFn: async (): Promise<PaymentAccountStatus> => {
      const { data, error } = await supabase
        .from('vendor_payment_accounts')
        .select('charges_enabled')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return 'none';
      return data.charges_enabled ? 'ready' : 'pending';
    },
    enabled: vendorId.length > 0,
  });
}

/**
 * 'link' gives the address of Stripe's setup page to open in the browser;
 * 'refresh' asks Stripe again (call it when the app comes back from there).
 */
export function useConnectPayments(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: 'link' | 'refresh') =>
      callFunction<{ url?: string; status: PaymentAccountStatus }>('stripe-connect', {
        vendorId,
        action,
      }),
    onSuccess: (result) => queryClient.setQueryData(depositKeys.account(vendorId), result.status),
  });
}
