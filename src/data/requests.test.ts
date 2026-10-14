import { proStatusOf, requestProblem, toLookingCard, toProposal, toRequest } from './requests';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: {
      from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }),
    },
  },
}));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

describe('requestProblem', () => {
  it('names each refusal', () => {
    expect(requestProblem(new Error('pro_only'))).toBe('proOnly');
    expect(requestProblem(new Error('already_open'))).toBe('alreadyOpen');
    expect(requestProblem(new Error('proposal_rate'))).toBe('rate');
    expect(requestProblem(new Error('proposals_full'))).toBe('proposalsFull');
    expect(requestProblem(new Error('already_sent'))).toBe('alreadySent');
    expect(requestProblem(new Error('invalid_price'))).toBe('invalid');
    expect(requestProblem(new Error('not_allowed'))).toBe('notAllowed');
    expect(requestProblem(new Error('Network request failed'))).toBe('offline');
    expect(requestProblem(new Error('boom'))).toBe('failed');
  });
});

describe('toRequest', () => {
  const row = {
    id: 'r1',
    category_slug: 'dhol',
    event_slug: 'jaago',
    event_date: '2027-06-11',
    guest_band: '250_500',
    budget_min_cents: 50000,
    budget_max_cents: 100000,
    note: 'Dhol for the jaago',
    city_slug: 'yuba-city',
    status: 'open',
    proposal_count: 3,
    expires_at: '2027-06-12T07:00:00Z',
    created_at: '2026-10-14T08:00:00Z',
  };

  it('maps a row, with the category and event for "Dhol player for the Jaago"', () => {
    expect(toRequest(row, new Date('2026-10-14T09:00:00Z'))).toMatchObject({
      categorySlug: 'dhol',
      eventSlug: 'jaago',
      status: 'open',
      expired: false,
      proposalCount: 3,
    });
  });

  it('marks an open request past its date as expired', () => {
    expect(toRequest(row, new Date('2027-07-01T00:00:00Z')).expired).toBe(true);
    expect(toRequest({ ...row, status: 'booked' }, new Date('2027-07-01T00:00:00Z')).expired).toBe(
      false,
    );
  });
});

describe('toLookingCard', () => {
  it('maps a card with postedAt and localized names', () => {
    const card = toLookingCard({
      id: 'r1',
      family_name: 'Harjit K.',
      city: 'Yuba City',
      category_slug: 'dhol',
      category_name: { en: 'Dhol player', pa: 'ਢੋਲੀ' },
      event_slug: 'jaago',
      event_name: { en: 'Jaago' },
      event_date: '2027-06-11',
      guest_band: '250_500',
      budget_min_cents: null,
      budget_max_cents: 100000,
      note: 'Two dholis please',
      miles: '4.2',
      proposal_count: 2,
      proposals_full: false,
      already_proposed: false,
      date_status: 'open',
      created_at: '2026-10-14T08:00:00Z',
    });
    expect(card).toMatchObject({
      familyName: 'Harjit K.',
      categoryName: { en: 'Dhol player', pa: 'ਢੋਲੀ' },
      eventName: { en: 'Jaago' },
      miles: 4.2,
      dateStatus: 'open',
      postedAt: '2026-10-14T08:00:00Z',
    });
  });
});

describe('toProposal', () => {
  it('maps the vendor with a cover photo', () => {
    const proposal = toProposal({
      id: 'p1',
      vendor_id: 'v1',
      vendor_slug: 'dhol-di-awaaz',
      vendor_name: 'Dhol Di Awaaz',
      vendor_name_pa: 'ਢੋਲ ਦੀ ਆਵਾਜ਼',
      vendor_city: 'Yuba City',
      cover_path: 'v1/photo',
      founding_number: 3,
      price_cents: 60000,
      price_unit: 'event',
      note: 'Two dholis, two hours',
      menu_id: null,
      reel_id: null,
      status: 'sent',
      conversation_id: null,
      created_at: '2026-10-14T08:00:00Z',
    });
    expect(proposal.vendor.name).toEqual({ en: 'Dhol Di Awaaz', pa: 'ਢੋਲ ਦੀ ਆਵਾਜ਼' });
    expect(proposal.vendor.photoUrl).toContain('v1/photo');
    expect(proposal.priceUnit).toBe('event');
  });
});

describe('proStatusOf', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  it('is Pro while paid up, and a few days after a failed renewal', () => {
    expect(proStatusOf(null, now).plan).toBe('free');
    expect(
      proStatusOf(
        {
          status: 'active',
          current_period_end: '2026-11-14T00:00:00Z',
          cancel_at_period_end: true,
        },
        now,
      ),
    ).toEqual({
      plan: 'pro',
      renewsOn: '2026-11-14T00:00:00Z',
      cancelAtPeriodEnd: true,
      pastDue: false,
    });
    expect(
      proStatusOf(
        {
          status: 'past_due',
          current_period_end: '2026-10-12T00:00:00Z',
          cancel_at_period_end: false,
        },
        now,
      ).plan,
    ).toBe('pro');
    expect(
      proStatusOf(
        {
          status: 'past_due',
          current_period_end: '2026-10-01T00:00:00Z',
          cancel_at_period_end: false,
        },
        now,
      ).plan,
    ).toBe('free');
    expect(
      proStatusOf(
        { status: 'canceled', current_period_end: null, cancel_at_period_end: false },
        now,
      ).plan,
    ).toBe('free');
  });
});
