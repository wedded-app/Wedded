import { queryClient } from '@/data/query-client';

import { answerAiConsent, requireAiConsent } from './ai-consent';

const mockPush = jest.fn();
const mockRpc = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (to: unknown) => mockPush(to) } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  },
}));

// The kept answer holds a timer that would keep Jest open
afterAll(() => queryClient.clear());

describe('requireAiConsent', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRpc.mockReset();
  });

  it('asks nobody while Wed shares nothing', async () => {
    const action = jest.fn();
    await requireAiConsent(action);
    expect(action).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('asks first, sends after a yes, and then never asks again', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    const action = jest.fn();
    await requireAiConsent(action, true);
    expect(action).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/wed-consent');

    await answerAiConsent(true);
    expect(mockRpc).toHaveBeenCalledWith('set_ai_consent', { p_allowed: true });
    expect(action).toHaveBeenCalledTimes(1);

    mockPush.mockClear();
    await requireAiConsent(action, true);
    expect(action).toHaveBeenCalledTimes(2);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('drops what was waiting after a no, and asks again next time', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await answerAiConsent(false);
    const action = jest.fn();
    await requireAiConsent(action, true);
    await answerAiConsent(false);
    expect(action).not.toHaveBeenCalled();
    await requireAiConsent(action, true);
    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});
