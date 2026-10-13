import {
  busiestDay,
  needsReplyNudge,
  replyTime,
  stepRate,
  toChecklist,
  toInsights,
  trackSearchAppearances,
} from './business-insights';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x/${p}` } }) }),
    },
  },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

beforeEach(() => mockRpc.mockReset());

describe('toInsights', () => {
  it('turns names into LocalizedText and numbers into numbers', () => {
    const insights = toInsights({
      daily: null,
      funnel: { searches: 2, views: 15, saves: 1, contacts: 2, inquiries: 2, booked: 1 },
      replies: { leads: 2, replied: 1, rate: '0.50' as unknown as number, medianMinutes: 90 },
      asks: {
        events: [{ slug: 'reception', name: { en: 'Reception', pa: 'ਰਿਸੈਪਸ਼ਨ' }, count: 2 }],
        guests: [],
        months: [],
        places: [],
      },
      compare: {
        category: { slug: 'caterer', name: 'not localized' },
        peers: 5,
        views: { mine: 15, typical: '3' as unknown as number },
        inquiries: { mine: 2, typical: 0 },
      },
    });
    expect(insights.daily).toEqual([]);
    expect(insights.replies.rate).toBe(0.5);
    expect(insights.asks.events[0].name).toEqual({ en: 'Reception', pa: 'ਰਿਸੈਪਸ਼ਨ' });
    expect(insights.compare?.category.name).toEqual({ en: 'caterer' });
    expect(insights.compare?.views.typical).toBe(3);
  });
});

describe('stepRate', () => {
  it('gives the share that reached the next step', () => {
    expect(stepRate(200, 30)).toBe(15);
    expect(stepRate(3, 1)).toBe(33);
    expect(stepRate(0, 4)).toBeNull();
  });
});

describe('replyTime', () => {
  it('reads as minutes, hours or days', () => {
    expect(replyTime(0.4)).toEqual({ unit: 'minutes', count: 1 });
    expect(replyTime(45)).toEqual({ unit: 'minutes', count: 45 });
    expect(replyTime(150)).toEqual({ unit: 'hours', count: 3 });
    expect(replyTime(47 * 60)).toEqual({ unit: 'hours', count: 47 });
    expect(replyTime(3 * 24 * 60)).toEqual({ unit: 'days', count: 3 });
  });
});

describe('needsReplyNudge', () => {
  const base = { leads: 10, replied: 9, rate: 0.9, medianMinutes: 120 };
  it('nudges slow or patchy repliers only', () => {
    expect(needsReplyNudge(base)).toBe(false);
    expect(needsReplyNudge({ ...base, rate: 0.6 })).toBe(true);
    expect(needsReplyNudge({ ...base, medianMinutes: 2 * 24 * 60 })).toBe(true);
    expect(needsReplyNudge({ leads: 0, replied: 0, rate: null, medianMinutes: null })).toBe(false);
  });
});

describe('busiestDay', () => {
  it('finds the day with the most views', () => {
    const day = (d: string, views: number) => ({
      day: d,
      views,
      contacts: 0,
      saves: 0,
      inquiries: 0,
    });
    expect(busiestDay([day('a', 1), day('b', 7), day('c', 7)])?.day).toBe('b');
    expect(busiestDay([])).toBeNull();
  });
});

describe('toChecklist', () => {
  it('puts what is missing first, most helpful first, and counts what is done', () => {
    const list = toChecklist([
      { key: 'instagram', done: false, count: null },
      { key: 'photos', done: false, count: 2 },
      { key: 'contact', done: true, count: null },
      { key: 'something-new', done: false, count: null },
    ]);
    expect(list.items).toEqual([
      { key: 'photos', done: false, count: 2 },
      { key: 'instagram', done: false },
      { key: 'contact', done: true },
    ]);
    expect(list.doneCount).toBe(1);
    expect(list.total).toBe(3);
  });
});

describe('trackSearchAppearances', () => {
  it('counts each vendor once per session, 50 at a time', () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const ids = Array.from({ length: 60 }, (_, i) => `v${i}`);
    trackSearchAppearances(ids);
    trackSearchAppearances(['v0', 'v1', 'new']);
    expect(mockRpc.mock.calls.map((c) => c[1].p_vendor_ids.length)).toEqual([50, 10, 1]);
    expect(mockRpc.mock.calls[2][1].p_vendor_ids).toEqual(['new']);
  });

  it('never throws when counting fails', () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    expect(() => trackSearchAppearances(['zz'])).not.toThrow();
  });
});
