import type { DepositPayment } from '@/data/deposits';

export type PayOutcome = 'paid' | 'canceled' | 'failed' | 'unsupported';

/** Stripe's card sheet is for phones: in a browser, families pay in the app. */
export async function presentDepositPayment(
  _payment: Extract<DepositPayment, { kind: 'pay' }>,
): Promise<PayOutcome> {
  return 'unsupported';
}
