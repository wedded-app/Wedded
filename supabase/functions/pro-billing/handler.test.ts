import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  chooseProSubscription,
  proAccess,
  proEventCustomer,
  proSettings,
  validProPrice,
} from '../_shared/pro.ts';
import { webhookHandler } from '../pro-webhook/handler.ts';
import { billingHandler } from './handler.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
const vendorId = 'b2200000-0000-4000-8000-000000000001';
const settings = {
  secretKey: 'sk_test_mock',
  priceId: 'price_Pro',
  returnUrl: 'https://wedded.example/business/pro',
  webhookSecret: 'whsec_mock',
};
const goodPrice = {
  id: 'price_Pro',
  active: true,
  livemode: false,
  currency: 'usd',
  unit_amount: 5000,
  type: 'recurring',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
};
function subscription(status = 'active', price = 'price_Pro', created = 1) {
  return {
    id: 'sub_Pro',
    status,
    created,
    livemode: false,
    cancel_at_period_end: false,
    items: {
      data: [{ price: { id: price }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }],
    },
  } as unknown as Stripe.Subscription;
}
function fixture() {
  const state = {
    authenticated: true,
    member: true,
    customer: 'cus_Pro' as string | null,
    subscriptions: [] as Stripe.Subscription[],
    rpcError: false,
    dbError: false,
    price: goodPrice,
    signatureOk: true,
    stripeFail: false,
    event: {
      id: 'evt_Pro',
      type: 'customer.subscription.updated',
      livemode: false,
      data: { object: { customer: 'cus_Pro' } },
    },
  };
  const calls: { name: string; params: unknown; options?: unknown }[] = [];
  const admin = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: state.authenticated ? { id: 'user_1', email: 'test@example.com' } : null },
          error: null,
        }),
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () =>
          Promise.resolve({
            error: state.dbError ? { message: 'database failure' } : null,
            data: table === 'vendor_members'
              ? (state.member ? { vendor_id: vendorId } : null)
              : (state.customer
                ? { stripe_customer_id: state.customer, vendor_id: vendorId, livemode: false }
                : null),
          }),
      };
      return query;
    },
    rpc: (name: string, params: unknown) => {
      calls.push({ name, params });
      return Promise.resolve({
        error: state.rpcError ? { message: 'save failed' } : null,
        data: name === 'save_pro_customer'
          ? 'cus_Pro'
          : name === 'claim_pro_checkout'
          ? [{ attempt_id: 'attempt_1', expires_at: new Date(Date.now() + 3600000).toISOString() }]
          : vendorId,
      });
    },
  } as unknown as SupabaseClient;
  const stripe = {
    subscriptions: {
      list: (params: unknown) => {
        calls.push({ name: 'list', params });
        if (state.stripeFail) throw new Error('Stripe failure');
        return Promise.resolve({ data: state.subscriptions, has_more: false });
      },
    },
    customers: {
      create: (params: unknown, options: unknown) => {
        calls.push({ name: 'customer', params, options });
        return Promise.resolve({ id: 'cus_Pro' });
      },
    },
    prices: { retrieve: () => Promise.resolve(state.price) },
    checkout: {
      sessions: {
        create: (params: unknown, options: unknown) => {
          calls.push({ name: 'checkout', params, options });
          return Promise.resolve({ url: 'https://checkout.stripe.com/test' });
        },
      },
    },
    billingPortal: {
      sessions: {
        create: (params: unknown) => {
          calls.push({ name: 'portal', params });
          return Promise.resolve({ url: 'https://billing.stripe.com/test' });
        },
      },
    },
    webhooks: {
      constructEventAsync: () => {
        if (!state.signatureOk) throw new Error('bad signature');
        return Promise.resolve(state.event);
      },
    },
  } as unknown as Stripe;
  const deps = { settings: () => settings, admin, stripe: () => stripe };
  return { state, calls, deps };
}
function request(action = 'checkout', authenticated = true) {
  return new Request('https://example.com', {
    method: 'POST',
    headers: authenticated ? { Authorization: 'Bearer token' } : {},
    body: JSON.stringify({ vendorId, action }),
  });
}

Deno.test('settings refuse live keys and unsafe return URLs', () => {
  const env = (overrides: Record<string, string | undefined>) =>
  (
    key: string,
  ) => ({
    STRIPE_SECRET_KEY: settings.secretKey,
    STRIPE_PRO_PRICE_ID: settings.priceId,
    STRIPE_PRO_RETURN_URL: settings.returnUrl,
    ...overrides,
  }[key]);
  equal(proSettings(env({}))?.priceId, 'price_Pro');
  equal(
    proSettings(env({ STRIPE_PRO_RETURN_URL: undefined, SUPABASE_URL: 'https://demo.supabase.co' }))
      ?.returnUrl,
    'https://demo.supabase.co/functions/v1/stripe-return',
  );
  equal(proSettings(env({ STRIPE_PRO_RETURN_URL: undefined })), null);
  for (
    const overrides of [
      { STRIPE_SECRET_KEY: 'sk_live_mock' },
      { STRIPE_PRO_RETURN_URL: 'javascript:alert(1)' },
      { STRIPE_PRO_RETURN_URL: 'http://evil.example' },
      { STRIPE_PRO_RETURN_URL: 'https://user:password@example.com' },
      { STRIPE_PRO_RETURN_URL: 'https://example.com?redirect=evil' },
    ]
  ) equal(proSettings(env(overrides)), null);
});
Deno.test('Pro price must be exactly $50 USD per month in test mode', () => {
  equal(validProPrice(goodPrice as unknown as Stripe.Price), true);
  for (
    const patch of [{ unit_amount: 500 }, { livemode: true }, { active: false }, {
      currency: 'cad',
    }, { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }]
  ) equal(validProPrice({ ...goodPrice, ...patch } as unknown as Stripe.Price), false);
});
Deno.test('only the configured product grants access; canceled older subscriptions do not mask active', () => {
  equal(chooseProSubscription([subscription('active', 'price_Other')], 'price_Pro'), null);
  equal(
    chooseProSubscription([
      subscription('canceled', 'price_Pro', 20),
      subscription('active', 'price_Pro', 1),
    ], 'price_Pro')?.status,
    'active',
  );
  equal(proAccess('paused', null), 'free');
  equal(proAccess('past_due', 1000, 1000 * 1000 + 2 * 86400000), 'pro');
  equal(proAccess('past_due', 1000, 1000 * 1000 + 3 * 86400000), 'free');
});
Deno.test('billing requires authentication and vendor membership before calling Stripe', async () => {
  const f = fixture();
  const handler = billingHandler(f.deps);
  equal((await handler(request('checkout', false))).status, 401);
  f.state.authenticated = false;
  equal((await handler(request())).status, 401);
  f.state.authenticated = true;
  f.state.member = false;
  equal((await handler(request())).status, 403);
  equal(f.calls.length, 0);
});
Deno.test('checkout uses the server price, return URLs and shared attempt key', async () => {
  const f = fixture();
  f.state.customer = null;
  const response = await billingHandler(f.deps)(request());
  equal(response.status, 200);
  equal(await response.json(), { url: 'https://checkout.stripe.com/test', status: 'free' });
  const checkout = f.calls.find((c) => c.name === 'checkout');
  const params = checkout?.params as Stripe.Checkout.SessionCreateParams;
  equal(params.customer, 'cus_Pro');
  equal(params.mode, 'subscription');
  equal(params.line_items, [{ price: 'price_Pro', quantity: 1 }]);
  equal(params.success_url, settings.returnUrl + '?pro=success');
  equal(checkout?.options, { idempotencyKey: 'pro-checkout-attempt_1' });
  equal(f.calls.find((c) => c.name === 'customer')?.options, {
    idempotencyKey: `pro-customer-${vendorId}`,
  });
});
Deno.test('existing subscriptions use the portal, not a second checkout', async () => {
  const f = fixture();
  f.state.subscriptions = [subscription()];
  equal((await billingHandler(f.deps)(request())).status, 409);
  const response = await billingHandler(f.deps)(request('portal'));
  equal(response.status, 200);
  equal(await response.json(), { url: 'https://billing.stripe.com/test', status: 'pro' });
  equal(f.calls.some((c) => c.name === 'checkout'), false);
});
Deno.test('refresh does not create customers and wrong prices cannot be purchased', async () => {
  const f = fixture();
  f.state.customer = null;
  equal(await (await billingHandler(f.deps)(request('refresh'))).json(), { status: 'free' });
  equal((await billingHandler(f.deps)(request('portal'))).status, 409);
  equal(f.calls.length, 0);
  f.state.customer = 'cus_Pro';
  f.state.price = { ...goodPrice, unit_amount: 1 };
  equal((await billingHandler(f.deps)(request())).status, 503);
  equal(f.calls.some((c) => c.name === 'checkout'), false);
});
Deno.test('failed customer persistence prevents checkout', async () => {
  const f = fixture();
  f.state.customer = null;
  f.state.rpcError = true;
  equal((await billingHandler(f.deps)(request())).status, 502);
  equal(f.calls.some((c) => c.name === 'checkout'), false);
});
Deno.test('missing settings, invalid actions and methods return explicit errors', async () => {
  const f = fixture();
  equal((await billingHandler({ ...f.deps, settings: () => null })(request())).status, 503);
  equal((await billingHandler(f.deps)(request('fake'))).status, 400);
  equal((await billingHandler(f.deps)(new Request('https://example.com'))).status, 405);
  equal(
    (await billingHandler(f.deps)(new Request('https://example.com', { method: 'OPTIONS' })))
      .status,
    200,
  );
});
Deno.test('webhook refuses bad signatures, ignores unrelated/Connect/live events', async () => {
  const f = fixture();
  f.state.signatureOk = false;
  equal((await webhookHandler(f.deps)(request())).status, 400);
  equal(f.calls.length, 0);
  f.state.signatureOk = true;
  f.state.event.type = 'customer.created';
  equal((await webhookHandler(f.deps)(request())).status, 200);
  equal(f.calls.length, 0);
  equal(
    proEventCustomer({ ...f.state.event, type: 'invoice.paid', account: 'acct_Connect' }),
    null,
  );
  equal(proEventCustomer({ ...f.state.event, type: 'invoice.paid', livemode: true }), null);
});
Deno.test('late/repeated webhook re-fetches current state; database failures trigger retries', async () => {
  const f = fixture();
  f.state.subscriptions = [subscription('canceled')];
  const handler = webhookHandler(f.deps);
  equal((await handler(request())).status, 200);
  equal((await handler(request())).status, 200);
  const writes = f.calls.filter((c) => c.name === 'save_pro_subscription');
  equal(writes.length, 2);
  equal((writes[0].params as Record<string, unknown>).p_status, 'canceled');
  equal(
    (f.calls.find((c) => c.name === 'list')?.params as Record<string, unknown>).price,
    'price_Pro',
  );
  f.state.rpcError = true;
  equal((await handler(request())).status, 500);
});
Deno.test('real Stripe signature verifies the raw body and rejects altered payloads', async () => {
  const f = fixture();
  const stripe = new Stripe('sk_test_mock', { httpClient: Stripe.createFetchHttpClient() });
  const payload = JSON.stringify(f.state.event);
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: settings.webhookSecret,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
  const handler = webhookHandler({ ...f.deps, stripe: () => stripe });
  f.state.customer = null;
  equal(
    (await handler(
      new Request('https://example.com', {
        method: 'POST',
        body: payload,
        headers: { 'Stripe-Signature': signature },
      }),
    )).status,
    200,
  );
  equal(
    (await handler(
      new Request('https://example.com', {
        method: 'POST',
        body: payload + ' ',
        headers: { 'Stripe-Signature': signature },
      }),
    )).status,
    400,
  );
});
