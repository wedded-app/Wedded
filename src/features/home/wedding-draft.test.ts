import { EMPTY_DRAFT, hasDraft, parseDraft } from './wedding-draft';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/storage', () => ({
  readSetting: () => null,
  writeSetting: async () => {},
  StorageKeys: { weddingDraft: 'planner.draft' },
}));

describe('parseDraft', () => {
  it('reads a date and a guest band', () => {
    expect(parseDraft('{"date":"2027-06-13","guestBand":"250_500"}')).toEqual({
      date: '2027-06-13',
      noDateYet: false,
      guestBand: '250_500',
    });
  });

  it('drops anything malformed', () => {
    expect(parseDraft('{"date":"June 13","guestBand":"lots"}')).toEqual(EMPTY_DRAFT);
    expect(parseDraft('not json')).toEqual(EMPTY_DRAFT);
    expect(parseDraft(null)).toEqual(EMPTY_DRAFT);
  });

  it('keeps "no date yet" only without a date', () => {
    expect(parseDraft('{"noDateYet":true}').noDateYet).toBe(true);
    expect(parseDraft('{"noDateYet":true,"date":"2027-06-13"}').noDateYet).toBe(false);
  });
});

describe('hasDraft', () => {
  it('is false until they answer something', () => {
    expect(hasDraft(EMPTY_DRAFT)).toBe(false);
    expect(hasDraft({ ...EMPTY_DRAFT, noDateYet: true })).toBe(true);
    expect(hasDraft({ ...EMPTY_DRAFT, guestBand: 'not_sure' })).toBe(true);
  });
});
