import {
  bookedFor,
  freeLine,
  likelyEvent,
  NO_FACTS,
  type StripFacts,
  stripState,
  vendorStandings,
} from './strip-state';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const dhol = { id: 'v-dhol', slug: 'dhol-di-awaaz', name: 'Dhol Di Awaaz' };
const hall = { id: 'v-hall', slug: 'royal-orchard', name: 'Royal Orchard' };

const events = [
  { slug: 'mehndi', name: 'Mehndi' },
  { slug: 'baraat', name: 'Baraat' },
];

const plan: StripFacts = {
  ...NO_FACTS,
  events,
  eventDates: { baraat: '2027-06-12' },
  weddingDate: '2027-06-13',
};

const vendorReel = (eventSlug: string | null = null) => ({
  vendor: dhol,
  tags: [],
  eventSlug,
});

describe('vendorStandings', () => {
  it('counts inquiries that went, and not ones that failed', () => {
    expect(
      vendorStandings(
        [
          { vendor_id: 'a', status: 'sent', followUpAnswer: null },
          { vendor_id: 'b', status: 'queued', followUpAnswer: 'no_reply' },
          { vendor_id: 'c', status: 'failed', followUpAnswer: null },
        ],
        [],
      ),
    ).toEqual({ a: 'asked', b: 'asked' });
  });

  it('takes the family at their word on the follow-up', () => {
    expect(
      vendorStandings(
        [
          { vendor_id: 'a', status: 'sent', followUpAnswer: 'deciding' },
          { vendor_id: 'b', status: 'sent', followUpAnswer: 'booked' },
          // An older inquiry doesn't undo a newer answer
          { vendor_id: 'b', status: 'sent', followUpAnswer: null },
        ],
        [],
      ),
    ).toEqual({ a: 'replied', b: 'booked' });
  });

  it("says they replied when the vendor's message is the last in the family's chat", () => {
    expect(
      vendorStandings(
        [
          { vendor_id: 'a', status: 'sent', followUpAnswer: null },
          { vendor_id: 'b', status: 'sent', followUpAnswer: null },
        ],
        [
          { side: 'family', vendor: { id: 'a' }, lastMessage: { senderRole: 'vendor' } },
          { side: 'family', vendor: { id: 'b' }, lastMessage: { senderRole: 'family' } },
          // Chatting without asking isn't an inquiry
          { side: 'family', vendor: { id: 'c' }, lastMessage: { senderRole: 'vendor' } },
          // The same person's business inbox doesn't count
          { side: 'vendor', vendor: { id: 'b' }, lastMessage: { senderRole: 'vendor' } },
        ],
      ),
    ).toEqual({ a: 'replied', b: 'asked' });
  });
});

describe('likelyEvent', () => {
  it("is the reel's own event when the family has it, else their first", () => {
    expect(likelyEvent('baraat', events)?.slug).toBe('baraat');
    expect(likelyEvent('jaago', events)?.slug).toBe('mehndi');
    expect(likelyEvent(null, events)?.slug).toBe('mehndi');
    expect(likelyEvent('baraat', [])).toBeNull();
  });
});

describe('bookedFor', () => {
  const bookedVendors = {
    'mehndi/dhol': { slug: dhol.slug, name: dhol.name },
    'baraat/dhol': { slug: dhol.slug, name: dhol.name },
    'reception/hall': { slug: hall.slug, name: hall.name },
  };

  it("prefers the reel's event, then ceremony order", () => {
    expect(bookedFor(dhol.slug, 'baraat', { bookedVendors, events }).event?.slug).toBe('baraat');
    expect(bookedFor(dhol.slug, null, { bookedVendors, events }).event?.slug).toBe('mehndi');
  });

  it("is booked without an event when the event isn't in the plan", () => {
    expect(bookedFor(hall.slug, null, { bookedVendors, events })).toEqual({
      found: true,
      event: null,
    });
    expect(bookedFor('someone-else', null, { bookedVendors, events })).toEqual({
      found: false,
      event: null,
    });
  });
});

describe('stripState', () => {
  it("checks the vendor's calendar on the family's likely event", () => {
    expect(stripState(vendorReel('baraat'), plan)).toEqual({
      kind: 'book',
      vendor: dhol,
      event: events[1],
      date: '2027-06-12',
      askEvent: 'baraat',
    });
    // No day for the Mehndi yet: the wedding day stands in
    expect(stripState(vendorReel(), plan)).toMatchObject({ event: events[0], date: '2027-06-13' });
  });

  it('checks no date without a plan, and asks with the reel’s event', () => {
    expect(stripState(vendorReel('jaago'), NO_FACTS)).toEqual({
      kind: 'book',
      vendor: dhol,
      event: null,
      date: null,
      askEvent: 'jaago',
    });
  });

  it('says they booked them, for which event', () => {
    const facts = { ...plan, bookedVendors: { 'baraat/dhol': { slug: dhol.slug, name: '' } } };
    expect(stripState(vendorReel(), facts)).toEqual({
      kind: 'booked',
      vendor: dhol,
      event: events[1],
    });
    // Booked by their own answer to "Did they get back to you?"
    expect(stripState(vendorReel(), { ...plan, standings: { [dhol.id]: 'booked' } })).toEqual({
      kind: 'booked',
      vendor: dhol,
      event: null,
    });
  });

  it('says they asked, and whether the vendor wrote back', () => {
    expect(stripState(vendorReel(), { ...plan, standings: { [dhol.id]: 'asked' } })).toEqual({
      kind: 'asked',
      vendor: dhol,
      replied: false,
    });
    expect(stripState(vendorReel(), { ...plan, standings: { [dhol.id]: 'replied' } })).toEqual({
      kind: 'asked',
      vendor: dhol,
      replied: true,
    });
  });

  it("shows nothing on a business's own reels", () => {
    expect(stripState(vendorReel(), { ...plan, myVendorIds: [dhol.id] })).toEqual({
      kind: 'none',
    });
  });

  it("offers a family's tagged vendors, and nothing when they tagged none", () => {
    const tag = (v: typeof dhol) => ({
      vendorId: v.id,
      slug: v.slug,
      name: v.name,
      approved: true,
    });
    expect(
      stripState(
        { vendor: null, tags: [tag(dhol), tag(hall), tag(dhol)], eventSlug: 'mehndi' },
        plan,
      ),
    ).toEqual({ kind: 'see', vendors: [dhol, hall], eventSlug: 'mehndi' });
    expect(stripState({ vendor: null, tags: [], eventSlug: null }, plan)).toEqual({ kind: 'none' });
  });
});

describe('freeLine', () => {
  it('says what the calendar says, and nothing about free when it does not know', () => {
    expect(freeLine('open', true)).toEqual({ key: 'free', tone: 'free' });
    expect(freeLine('booked', true)).toEqual({ key: 'booked', tone: 'busy' });
    expect(freeLine('held', true)).toEqual({ key: 'held', tone: 'maybe' });
    expect(freeLine('partly', true)).toEqual({ key: 'partly', tone: 'maybe' });
    expect(freeLine('unknown', true)).toEqual({ key: 'askEvent', tone: null });
    expect(freeLine(undefined, true)).toEqual({ key: 'askEvent', tone: null });
    expect(freeLine('open', false)).toEqual({ key: 'askAbout', tone: null });
  });
});
