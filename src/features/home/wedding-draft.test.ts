import { draftPlan, EMPTY_DRAFT, hasDraft, hasDraftPlan, parseDraft } from './wedding-draft';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/storage', () => ({
  readSetting: () => null,
  writeSetting: async () => {},
  StorageKeys: { weddingDraft: 'planner.draft' },
}));

describe('parseDraft', () => {
  it('reads a date and a guest band, as the old quick questions kept them', () => {
    expect(parseDraft('{"date":"2027-06-13","guestBand":"250_500"}')).toEqual({
      ...EMPTY_DRAFT,
      date: '2027-06-13',
      guestBand: '250_500',
    });
  });

  it('reads the plan the first questions made', () => {
    const draft = parseDraft(
      JSON.stringify({
        date: '2027-06-12',
        traditions: ['punjabi-sikh'],
        events: ['roka', 'anand-karaj'],
        eventDates: { roka: '2027-02-06', 'anand-karaj': '2027-06-12' },
        planningFor: 'self',
      }),
    );
    expect(draft.events).toEqual(['roka', 'anand-karaj']);
    expect(draft.eventDates).toEqual({ roka: '2027-02-06', 'anand-karaj': '2027-06-12' });
    expect(draft.traditions).toEqual(['punjabi-sikh']);
    expect(draft.planningFor).toBe('self');
  });

  it('drops anything malformed', () => {
    expect(parseDraft('{"date":"June 13","guestBand":"lots"}')).toEqual(EMPTY_DRAFT);
    expect(parseDraft('{"events":"roka","eventDates":{"roka":"soon"}}')).toEqual(EMPTY_DRAFT);
    expect(parseDraft('not json')).toEqual(EMPTY_DRAFT);
    expect(parseDraft(null)).toEqual(EMPTY_DRAFT);
  });

  it('keeps "no date yet" only without a date', () => {
    expect(parseDraft('{"noDateYet":true}').noDateYet).toBe(true);
    expect(parseDraft('{"noDateYet":true,"date":"2027-06-13"}').noDateYet).toBe(false);
  });
});

describe('hasDraft and hasDraftPlan', () => {
  it('is false until they answer something', () => {
    expect(hasDraft(EMPTY_DRAFT)).toBe(false);
    expect(hasDraft({ ...EMPTY_DRAFT, noDateYet: true })).toBe(true);
    expect(hasDraft({ ...EMPTY_DRAFT, guestBand: 'not_sure' })).toBe(true);
  });

  it('counts as a plan only once there are events', () => {
    expect(hasDraftPlan({ ...EMPTY_DRAFT, date: '2027-06-13' })).toBe(false);
    expect(hasDraftPlan({ ...EMPTY_DRAFT, events: ['roka'] })).toBe(true);
  });
});

describe('draftPlan', () => {
  it('gives every event the guest band, and books nothing', () => {
    const plan = draftPlan({
      ...EMPTY_DRAFT,
      date: '2027-06-12',
      guestBand: '250_500',
      events: ['roka', 'anand-karaj'],
    });
    expect(plan.weddingDate).toBe('2027-06-12');
    expect(plan.guests).toEqual({ roka: '250_500', 'anand-karaj': '250_500' });
    expect(plan.booked).toEqual({});
  });
});
