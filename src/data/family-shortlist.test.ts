import { toShortlistVendor, withReaction } from './family-shortlist';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const row = {
  vendor_id: 'v1',
  slug: 'royal-orchard',
  name: 'Royal Orchard',
  city: 'Yuba City',
  published: true,
  event_slugs: ['reception'],
  saved_by: ['Asha', 'Bal'],
  loves: 1,
  maybes: 1,
  nos: 0,
  my_reaction: 'maybe',
  loved_by: ['Bal'],
};

describe('family shortlist', () => {
  it('reads a row from the API', () => {
    const vendor = toShortlistVendor(row);
    expect(vendor.name).toEqual({ en: 'Royal Orchard' });
    expect(vendor.counts).toEqual({ love: 1, maybe: 1, no: 0 });
    expect(vendor.myReaction).toBe('maybe');
  });

  it('moves my reaction and the counts together', () => {
    const vendor = toShortlistVendor(row);
    const loved = withReaction(vendor, 'love');
    expect(loved.counts).toEqual({ love: 2, maybe: 0, no: 0 });
    expect(loved.myReaction).toBe('love');
    const cleared = withReaction(loved, null);
    expect(cleared.counts).toEqual({ love: 1, maybe: 0, no: 0 });
    expect(cleared.myReaction).toBeNull();
  });
});
