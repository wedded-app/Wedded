import {
  californiaToday,
  orderLeads,
  percentChange,
  startBusinessErrorKind,
  statsPeriods,
  toLead,
  toStats,
  trackReelView,
  waitingCount,
  type Lead,
} from './business';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

beforeEach(() => mockRpc.mockReset());

describe('californiaToday', () => {
  it('uses the California day, not UTC', () => {
    // 3 am UTC on Oct 13 is still the evening of Oct 12 in California
    expect(californiaToday(new Date('2026-10-13T03:00:00Z'))).toBe('2026-10-12');
    expect(californiaToday(new Date('2026-10-13T08:00:00Z'))).toBe('2026-10-13');
  });
});

describe('statsPeriods', () => {
  it('gives the last N days and the N days before, inclusive', () => {
    expect(statsPeriods(7, '2026-10-12')).toEqual({
      current: { from: '2026-10-06', to: '2026-10-12' },
      previous: { from: '2026-09-29', to: '2026-10-05' },
    });
  });

  it('crosses month and year ends', () => {
    expect(statsPeriods(30, '2027-01-10').previous).toEqual({
      from: '2026-11-12',
      to: '2026-12-11',
    });
  });
});

describe('percentChange', () => {
  it('rounds to a whole percent, up or down', () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(10, 3)).toBe(233);
  });

  it('has nothing to compare with after a period of 0', () => {
    expect(percentChange(4, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe('toStats', () => {
  it('renames reel views and fills zeros when there is no row', () => {
    const row = {
      views: 3,
      calls: 1,
      texts: 0,
      whatsapps: 1,
      directions: 0,
      instagram: 0,
      website: 0,
      shares: 2,
      contacts: 2,
      saves: 1,
      inquiries: 2,
      reel_views: 40,
    };
    expect(toStats(row)).toMatchObject({ views: 3, contacts: 2, reelViews: 40 });
    expect(toStats(row)).not.toHaveProperty('reel_views');
    expect(toStats(undefined).views).toBe(0);
  });
});

const row = {
  id: 'l1',
  created_at: '2026-10-12T18:00:00Z',
  family_name: 'Harjit K.',
  event_slugs: ['reception'],
  event_date: '2027-06-12',
  start_time: null,
  guest_band: '100_250',
  location: 'Yuba City',
  message: 'Is June 12 open?',
  details: { tour: true, tourSlots: [] },
  is_tour: true,
  preferred_contact: 'whatsapp',
  phone: '+15305550101',
  email: null,
  conversation_id: 'c1',
  replied: false,
};

describe('toLead', () => {
  it('maps a row', () => {
    expect(toLead(row)).toMatchObject({
      familyName: 'Harjit K.',
      kind: 'tour',
      preferredContact: 'whatsapp',
      conversationId: 'c1',
      details: { tour: true },
    });
  });

  it('copes with odd details and contact methods', () => {
    const lead = toLead({ ...row, details: null, preferred_contact: 'pigeon', is_tour: false });
    expect(lead.details).toEqual({});
    expect(lead.preferredContact).toBe('call');
    expect(lead.kind).toBe('inquiry');
  });
});

describe('orderLeads and waitingCount', () => {
  const lead = (id: string, createdAt: string, replied: boolean): Lead => ({
    ...toLead(row),
    id,
    createdAt,
    replied,
  });
  const leads = [
    lead('old-waiting', '2026-10-01T00:00:00Z', false),
    lead('new-replied', '2026-10-12T00:00:00Z', true),
    lead('new-waiting', '2026-10-11T00:00:00Z', false),
    lead('old-replied', '2026-09-01T00:00:00Z', true),
  ];

  it('puts the ones waiting on a reply first, newest first in each', () => {
    expect(orderLeads(leads).map((l) => l.id)).toEqual([
      'new-waiting',
      'old-waiting',
      'new-replied',
      'old-replied',
    ]);
  });

  it('counts the ones waiting', () => {
    expect(waitingCount(leads)).toBe(2);
  });
});

describe('trackReelView', () => {
  it('counts each reel once per session', () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    trackReelView('r1');
    trackReelView('r1');
    trackReelView('r2');
    expect(mockRpc.mock.calls.map((c) => c[1].p_reel_id)).toEqual(['r1', 'r2']);
  });

  it('never throws when counting fails', () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    expect(() => trackReelView('r3')).not.toThrow();
  });
});

describe('startBusinessErrorKind', () => {
  it('names each server error', () => {
    expect(startBusinessErrorKind('needs_profile')).toBe('needsProfile');
    expect(startBusinessErrorKind('too_many_drafts')).toBe('tooMany');
    expect(startBusinessErrorKind('invalid_city')).toBe('invalid');
    expect(startBusinessErrorKind('TypeError: Network request failed')).toBe('offline');
    expect(startBusinessErrorKind('boom')).toBe('failed');
  });
});
