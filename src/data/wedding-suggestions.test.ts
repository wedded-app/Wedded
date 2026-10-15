import {
  openCounts,
  orderSuggestions,
  suggestErrorKind,
  toSuggestion,
  type WeddingSuggestion,
} from './wedding-suggestions';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const base: WeddingSuggestion = {
  id: 's1',
  eventSlug: 'reception',
  categorySlug: 'banquet-hall',
  note: null,
  status: 'open',
  suggestedBy: 'u1',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-10-01T10:00:00Z',
  vendor: { id: 'v1', slug: 'royal-orchard', name: { en: 'Royal Orchard' } },
};

describe('suggestions', () => {
  it('turns a row into a suggestion, with the vendor name', () => {
    const s = toSuggestion({
      id: 's1',
      event_slug: 'reception',
      category_slug: 'banquet-hall',
      note: 'Big parking lot',
      status: 'accepted',
      suggested_by: 'u1',
      resolved_by: 'u2',
      resolved_at: '2026-10-02T10:00:00Z',
      created_at: '2026-10-01T10:00:00Z',
      vendor: { id: 'v1', slug: 'royal-orchard', name: 'Royal Orchard' },
    });
    expect(s.status).toBe('accepted');
    expect(s.vendor?.name).toEqual({ en: 'Royal Orchard' });
  });

  it('shows open ones first, oldest first, then those decided in the last two weeks', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const list = [
      {
        ...base,
        id: 'old-decided',
        status: 'declined' as const,
        createdAt: '2026-08-01T00:00:00Z',
        resolvedAt: '2026-09-01T00:00:00Z',
      },
      { ...base, id: 'new-open', createdAt: '2026-10-19T00:00:00Z' },
      {
        ...base,
        id: 'recent-accepted',
        status: 'accepted' as const,
        // Suggested long ago, decided this week: still shown
        createdAt: '2026-08-15T00:00:00Z',
        resolvedAt: '2026-10-18T00:00:00Z',
      },
      { ...base, id: 'old-open', createdAt: '2026-09-02T00:00:00Z' },
    ];
    expect(orderSuggestions(list, now).map((s) => s.id)).toEqual([
      'old-open',
      'new-open',
      'recent-accepted',
    ]);
  });

  it('counts open suggestions per event and vendor type', () => {
    expect(
      openCounts([
        base,
        { ...base, id: 's2', vendor: null },
        { ...base, id: 's3', categorySlug: 'dj' },
        { ...base, id: 's4', status: 'declined' },
      ]),
    ).toEqual({ 'reception/banquet-hall': 2, 'reception/dj': 1 });
  });

  it('names what went wrong from the database error', () => {
    expect(suggestErrorKind(new Error('event_not_in_plan'))).toBe('eventNotInPlan');
    expect(suggestErrorKind(new Error('vendor_not_found'))).toBe('vendorGone');
    expect(suggestErrorKind(new Error('suggestion_limit'))).toBe('limit');
    expect(suggestErrorKind(new Error('not_allowed'))).toBe('notAllowed');
    expect(suggestErrorKind(new Error('Network request failed'))).toBe('failed');
  });
});
