import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';

import type { DepositPayment } from '@/data/deposits';

export type PayOutcome = 'paid' | 'canceled' | 'failed' | 'unsupported';

/**
 * Shows Stripe's own card sheet for a deposit, on the vendor's Stripe
 * account. 'paid' means Stripe took the card; the deposit itself turns paid
 * a moment later, when Stripe tells the server. Cards only: Apple Pay needs
 * a development build.
 */
export async function presentDepositPayment(
  payment: Extract<DepositPayment, { kind: 'pay' }>,
): Promise<PayOutcome> {
  const returnURL = Linking.createURL('/stripe-redirect');
  await initStripe({
    publishableKey: payment.publishableKey,
    stripeAccountId: payment.stripeAccountId,
    urlScheme: Linking.createURL('/'),
  });
  const setup = await initPaymentSheet({
    paymentIntentClientSecret: payment.clientSecret,
    merchantDisplayName: payment.vendorName,
    returnURL,
  });
  if (setup.error) return 'failed';
  const result = await presentPaymentSheet();
  if (!result.error) return 'paid';
  return result.error.code === 'Canceled' ? 'canceled' : 'failed';
}
