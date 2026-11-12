import en from '@/i18n/en.json';

import { EMPTY_DRAFT, type AskDraft } from './ask-draft';
import { listOf, ordinal, writtenMessage, type MessageFacts } from './ask-message';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/** The app's own strings, with {{name}} filled in, like useLocale().t. */
function t(key: string, options: Record<string, string | number> = {}) {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
  if (typeof value !== 'string') throw new Error(`Missing string ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
}

const draft = (patch: Partial<AskDraft>): AskDraft => ({
  ...EMPTY_DRAFT,
  vendorId: 'v1',
  ...patch,
});
const facts = (patch: Partial<MessageFacts>): MessageFacts => ({
  events: [],
  eventDates: [],
  date: null,
  guests: null,
  place: null,
  set: null,
  counters: [],
  ...patch,
});

describe('writtenMessage', () => {
  it("writes a hall's ask the way Fezy's mockup reads", () => {
    expect(
      writtenMessage(
        t,
        draft({ timeOfDay: 'evening', whoCooks: 'own', alcohol: 'yes', baraat: true }),
        facts({
          events: ['Reception'],
          date: '2027-06-19',
          guests: 300,
          set: 'venue',
          alcoholPolicy: 'full_bar',
        }),
      ),
    ).toBe(
      "Hello! We're planning our Reception on Saturday, June 19, 2027, in the evening, for about 300 guests. We're bringing our own caterer, we'd like to use your bar and the baraat will arrive at the hall with a horse and dhol. Could you share your price, and is the 19th still open? Thank you.",
    );
  });

  it('names a procession that is not a baraat, without the horse and dhol', () => {
    expect(
      writtenMessage(
        t,
        draft({ baraat: true }),
        facts({ events: ['Wedding party'], set: 'venue', procession: 'Zaffa' }),
      ),
    ).toContain('The Zaffa will arrive at the hall.');
  });

  it("asks a hall's kitchen for the menu they picked", () => {
    expect(
      writtenMessage(
        t,
        draft({ whoCooks: 'kitchen', menu: 'nonveg', meat: 'halal' }),
        facts({ events: ['Walima'], set: 'venue', counters: ['tandoor', 'chai'] }),
      ),
    ).toBe(
      "Hello! We're planning our Walima. We'd like your kitchen to do the food: veg and non-veg, halal, with tandoor and chai counters. Could you share your price? Thank you.",
    );
  });

  it('says where for vendors who come to the event, and their own bar policy', () => {
    expect(
      writtenMessage(
        t,
        draft({ timeOfDay: 'day', alcohol: 'yes' }),
        facts({ events: ['Jaago'], place: 'Yuba City', guests: 120, set: null }),
      ),
    ).toBe(
      "Hello! We're planning our Jaago in Yuba City, during the day, for about 120 guests. Could you share your price? Thank you.",
    );
    expect(
      writtenMessage(t, draft({ alcohol: 'yes' }), facts({ set: 'venue', alcoholPolicy: 'byob' })),
    ).toBe(
      "Hello! We're planning a wedding. We'll bring our own drinks. Could you share your price? Thank you.",
    );
  });

  it("names each event's day from the plan when there are two or more", () => {
    expect(
      writtenMessage(
        t,
        draft({}),
        facts({
          events: ['Sangeet', 'Reception'],
          eventDates: [
            { event: 'Sangeet', date: '2027-06-16' },
            { event: 'Reception', date: '2027-06-19' },
          ],
          date: '2027-06-16',
        }),
      ),
    ).toBe(
      "Hello! We're planning our Sangeet on Wednesday, June 16, 2027 and Reception on Saturday, June 19, 2027. Could you share your price, and are those days still open? Thank you.",
    );
  });

  it("writes a caterer's menu and a tasting", () => {
    expect(
      writtenMessage(
        t,
        draft({ menu: 'veg', tasting: true }),
        facts({ events: ['Anand Karaj'], set: 'caterer', place: 'Gurdwara Sahib, Sacramento' }),
      ),
    ).toBe(
      "Hello! We're planning our Anand Karaj in Gurdwara Sahib, Sacramento. For the menu, we'd like veg only. We'd love a tasting first. Could you share your price? Thank you.",
    );
  });

  it('asks to visit on the days they picked', () => {
    expect(
      writtenMessage(
        t,
        draft({ tour: true, visitDays: ['2026-11-14', '2026-11-16'], visitPart: 'morning' }),
        facts({ events: ['Reception'], set: 'venue' }),
      ),
    ).toBe(
      "Hello! We're planning our Reception. We'd like to come and see the hall. Could we visit on Sat, Nov 14 or Mon, Nov 16, in the morning? Thank you.",
    );
  });
});

describe('ordinal and listOf', () => {
  it('says days and lists the way people do', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 19, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '19th',
      '21st',
      '22nd',
      '23rd',
      '31st',
    ]);
    expect(listOf([], 'and')).toBe('');
    expect(listOf(['a'], 'and')).toBe('a');
    expect(listOf(['a', 'b', 'c'], 'or')).toBe('a, b or c');
  });
});
