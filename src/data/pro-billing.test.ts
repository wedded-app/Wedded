import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { callProBilling, proBillingProblem } from './pro-billing';
import { supabase } from '@/lib/supabase';
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('./requests', () => ({
  requestKeys: {
    all: ['requests'],
    pro: (id: string) => ['requests', 'pro', id],
    summary: (id: string) => ['requests', 'summary', id],
  },
}));
const mockInvoke = supabase.functions.invoke as jest.Mock;
beforeEach(() => mockInvoke.mockReset());
it('calls only the server billing action and returns the Stripe URL', async () => {
  mockInvoke.mockResolvedValue({
    data: { url: 'https://checkout.stripe.com/test', status: 'free' },
    error: null,
  });
  await expect(callProBilling('v1', 'checkout')).resolves.toEqual({
    url: 'https://checkout.stripe.com/test',
    status: 'free',
  });
  expect(mockInvoke).toHaveBeenCalledWith('pro-billing', {
    body: { vendorId: 'v1', action: 'checkout' },
  });
});
it('refresh needs no URL', async () => {
  mockInvoke.mockResolvedValue({ data: { status: 'pro' }, error: null });
  await expect(callProBilling('v1', 'refresh')).resolves.toEqual({ status: 'pro' });
});
it.each([
  [401, 'unauthorized', 'signIn'],
  [403, 'not_allowed', 'notAllowed'],
  [503, 'not_set_up', 'notSetUp'],
  [409, 'already_subscribed', 'alreadySubscribed'],
  [409, 'no_customer', 'noCustomer'],
  [502, 'billing_error', 'failed'],
])('maps billing error %s', async (status, code, problem) => {
  mockInvoke.mockResolvedValue({
    data: null,
    error: new FunctionsHttpError({ status, json: async () => ({ error: code }) }),
  });
  await expect(callProBilling('v1', 'checkout')).rejects.toMatchObject({ problem });
});
it('maps network failures', async () => {
  mockInvoke.mockResolvedValue({
    data: null,
    error: new FunctionsFetchError(new Error('offline')),
  });
  await expect(callProBilling('v1', 'checkout')).rejects.toMatchObject({ problem: 'offline' });
});
it.each([
  'http://checkout.stripe.com/test',
  'https://evil.example',
  'https://checkout.stripe.com.evil.example',
  'https://user:pass@checkout.stripe.com/test',
])('refuses unsafe billing URL %s', async (url) => {
  mockInvoke.mockResolvedValue({ data: { status: 'free', url }, error: null });
  await expect(callProBilling('v1', 'checkout')).rejects.toMatchObject({ problem: 'failed' });
});
it('refuses missing or malformed results', async () => {
  mockInvoke.mockResolvedValue({ data: { status: 'unknown' }, error: null });
  await expect(callProBilling('v1', 'refresh')).rejects.toMatchObject({ problem: 'failed' });
});

it('maps domain problems and unknown errors', () => {
  expect(proBillingProblem(new FunctionsFetchError(new Error('offline')))).toBe('offline');
  expect(proBillingProblem(new Error('unknown'))).toBe('failed');
});
