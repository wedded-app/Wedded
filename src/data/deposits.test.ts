import {
  canCancel,
  canPay,
  depositProblem,
  dollarsToCents,
  formatCents,
  toDeposit,
} from './deposits';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

describe('dollarsToCents', () => {
  it('reads what people type', () => {
    expect(dollarsToCents('500')).toBe(50000);
    expect(dollarsToCents('$1,250.50')).toBe(125050);
    expect(dollarsToCents(' 75.5 ')).toBe(7550);
  });

  it('refuses anything that is not $1 to $25,000', () => {
    expect(dollarsToCents('0.50')).toBeNull();
    expect(dollarsToCents('25000.01')).toBeNull();
    expect(dollarsToCents('five hundred')).toBeNull();
    expect(dollarsToCents('10.999')).toBeNull();
    expect(dollarsToCents('')).toBeNull();
  });
});

describe('formatCents', () => {
  it('shows cents only when there are some', () => {
    expect(formatCents(50000)).toBe('$500');
    expect(formatCents(125050)).toBe('$1,250.50');
  });
});

const row = {
  id: 'd1',
  conversation_id: 'c1',
  vendor_id: 'v1',
  amount_cents: 50000,
  event_slug: 'reception',
  note: 'Holds June 12',
  status: 'requested',
  created_at: '2026-10-13T20:00:00Z',
  paid_at: null,
  canceled_at: null,
  refunded_at: null,
};

describe('toDeposit, canPay and canCancel', () => {
  it('maps a row', () => {
    expect(toDeposit(row)).toMatchObject({ id: 'd1', amountCents: 50000, status: 'requested' });
    expect(toDeposit({ ...row, status: 'weird' }).status).toBe('requested');
  });

  it('lets the family pay until it is paid, and the vendor cancel until someone pays', () => {
    expect(canPay({ status: 'requested' })).toBe(true);
    expect(canPay({ status: 'failed' })).toBe(true);
    expect(canPay({ status: 'paid' })).toBe(false);
    expect(canCancel({ status: 'requested' })).toBe(true);
    expect(canCancel({ status: 'processing' })).toBe(false);
    expect(canCancel({ status: 'paid' })).toBe(false);
  });
});

describe('depositProblem', () => {
  it('names the database refusals', () => {
    expect(depositProblem(new Error('payments_not_ready'))).toBe('notReady');
    expect(depositProblem(new Error('family_first'))).toBe('familyFirst');
    expect(depositProblem(new Error('invalid_amount'))).toBe('invalidAmount');
    expect(depositProblem(new Error('too_many_open'))).toBe('tooMany');
    expect(depositProblem(new Error('not_cancelable'))).toBe('notPayable');
    expect(depositProblem(new Error('boom'))).toBe('failed');
  });
});
