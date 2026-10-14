// Stripe for deposits (#209): the client, and the small decisions the
// deposit functions share, kept apart so they can be tested without Stripe.
//
// Secrets: STRIPE_SECRET_KEY (sk_test_… until live payments), STRIPE_PUBLISHABLE_KEY
// (pk_test_…, handed to the app), STRIPE_WEBHOOK_SECRET (whsec_…, the Connect
// webhook). Without the secret key every deposit function answers 503
// { error: 'not_set_up' }, and the app says deposits are coming soon.

import Stripe from 'stripe';

export function stripeSettings():
  | { secretKey: string; publishableKey: string; webhookSecret: string | undefined }
  | null {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY')?.trim();
  if (!secretKey || !publishableKey) return null;
  return {
    secretKey,
    publishableKey,
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim() || undefined,
  };
}

export function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
}

export type PaymentStatus = 'none' | 'pending' | 'ready';

/** Where a vendor's Stripe account stands: not connected, setup unfinished, or taking payments. */
export function paymentStatus(
  account: { charges_enabled: boolean; details_submitted: boolean } | null,
): PaymentStatus {
  if (!account) return 'none';
  return account.charges_enabled ? 'ready' : 'pending';
}

/** "Royal Orchard deposit · Reception", what the card statement and receipt say. */
export function depositDescription(vendorName: string, eventName: string | null): string {
  const text = eventName ? `${vendorName} deposit · ${eventName}` : `${vendorName} deposit`;
  return text.slice(0, 200);
}

export type DepositOutcome = { paymentIntentId: string; outcome: 'paid' | 'failed' | 'refunded' };
export type AccountUpdate = {
  accountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
};

/** What a Stripe webhook event means for Wedded, or null when it doesn't matter. */
export function readStripeEvent(
  event: { type: string; data: { object: Record<string, unknown> } },
): { deposit: DepositOutcome } | { account: AccountUpdate } | null {
  const object = event.data.object;
  const id = typeof object.id === 'string' ? object.id : null;
  switch (event.type) {
    case 'payment_intent.succeeded':
      return id ? { deposit: { paymentIntentId: id, outcome: 'paid' } } : null;
    case 'payment_intent.payment_failed':
      return id ? { deposit: { paymentIntentId: id, outcome: 'failed' } } : null;
    case 'charge.refunded': {
      // Only a full refund undoes the deposit
      const intent = typeof object.payment_intent === 'string' ? object.payment_intent : null;
      return intent && object.refunded === true
        ? { deposit: { paymentIntentId: intent, outcome: 'refunded' } }
        : null;
    }
    case 'account.updated':
      return id
        ? {
          account: {
            accountId: id,
            chargesEnabled: object.charges_enabled === true,
            detailsSubmitted: object.details_submitted === true,
          },
        }
        : null;
    default:
      return null;
  }
}

/** Payment states where the family can still finish paying with the same payment. */
export function canReusePayment(status: string): boolean {
  return ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(status);
}
