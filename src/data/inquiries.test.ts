import { followUpDue } from './inquiries';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

const now = new Date('2026-10-10T12:00:00Z').getTime();
const at = (daysAgo: number) => new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();

describe('followUpDue', () => {
  it('asks from the time the database scheduled', () => {
    expect(followUpDue({ asked_at: at(0), answer: null }, now)).toBe(true);
    expect(followUpDue({ asked_at: at(-0.1), answer: null }, now)).toBe(false);
  });

  it('stops asking once answered', () => {
    expect(followUpDue({ asked_at: at(3), answer: 'no_reply' }, now)).toBe(false);
  });

  it('never asks about an inquiry that did not send (it has no follow-up)', () => {
    expect(followUpDue(undefined, now)).toBe(false);
  });
});
