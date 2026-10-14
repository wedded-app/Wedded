// deno test supabase/functions/_shared/stripe.test.ts --config supabase/functions/pay-deposit/deno.json
// (not run in CI; CI lints and format-checks the shared code).
import { canReusePayment, depositDescription, paymentStatus, readStripeEvent } from './stripe.ts';

function expectEqual(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}

Deno.test('a vendor is ready only once Stripe says it can take payments', () => {
  expectEqual(paymentStatus(null), 'none', 'none');
  expectEqual(
    paymentStatus({ charges_enabled: false, details_submitted: true }),
    'pending',
    'pending',
  );
  expectEqual(paymentStatus({ charges_enabled: true, details_submitted: true }), 'ready', 'ready');
});

Deno.test('the statement says whose deposit and for what', () => {
  expectEqual(
    depositDescription('Royal Orchard', 'Reception'),
    'Royal Orchard deposit · Reception',
    'event',
  );
  expectEqual(depositDescription('Royal Orchard', null), 'Royal Orchard deposit', 'no event');
});

Deno.test('webhook events turn into deposit outcomes and account updates', () => {
  const event = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });
  expectEqual(
    readStripeEvent(event('payment_intent.succeeded', { id: 'pi_1' })),
    { deposit: { paymentIntentId: 'pi_1', outcome: 'paid' } },
    'paid',
  );
  expectEqual(
    readStripeEvent(event('payment_intent.payment_failed', { id: 'pi_1' })),
    { deposit: { paymentIntentId: 'pi_1', outcome: 'failed' } },
    'failed',
  );
  expectEqual(
    readStripeEvent(
      event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', refunded: true }),
    ),
    { deposit: { paymentIntentId: 'pi_1', outcome: 'refunded' } },
    'full refund',
  );
  expectEqual(
    readStripeEvent(
      event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', refunded: false }),
    ),
    null,
    'partial refund',
  );
  expectEqual(
    readStripeEvent(
      event('account.updated', { id: 'acct_1', charges_enabled: true, details_submitted: true }),
    ),
    { account: { accountId: 'acct_1', chargesEnabled: true, detailsSubmitted: true } },
    'account',
  );
  expectEqual(readStripeEvent(event('customer.created', { id: 'cus_1' })), null, 'other');
});

Deno.test('an unfinished payment is picked up again; a finished one is not', () => {
  expectEqual(canReusePayment('requires_payment_method'), true, 'needs card');
  expectEqual(canReusePayment('requires_action'), true, '3D Secure');
  expectEqual(canReusePayment('succeeded'), false, 'succeeded');
  expectEqual(canReusePayment('canceled'), false, 'canceled');
});
