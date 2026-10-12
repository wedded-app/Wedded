import { changeFrom, leadAnswerRows } from './business-format';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const t = (key: string) => key.replace('inquiry.questions.', '');

describe('changeFrom', () => {
  it('says up or down by a whole percent', () => {
    expect(changeFrom(12, 10)).toEqual({ kind: 'up', percent: 20 });
    expect(changeFrom(5, 10)).toEqual({ kind: 'down', percent: 50 });
    expect(changeFrom(10, 10)).toEqual({ kind: 'same', percent: 0 });
  });

  it('says nothing when there was nothing before', () => {
    expect(changeFrom(7, 0)).toBeNull();
    expect(changeFrom(0, 0)).toBeNull();
  });
});

describe('leadAnswerRows', () => {
  it('reads a hall tour in the Ask form words', () => {
    expect(
      leadAnswerRows(
        {
          catering: 'own',
          ownCaterer: 'Saffron Tandoor',
          alcohol: 'not_sure',
          ghoriDhol: true,
          sameDay: false,
          tour: true,
          tourSlots: [{ date: '2027-03-06', part: 'evening' }],
        },
        t,
      ),
    ).toEqual([
      { label: 'catering', value: 'cateringOwn: Saffron Tandoor' },
      { label: 'alcohol', value: 'notSure' },
      { label: 'ghoriDhol', value: 'yes' },
      { label: 'sameDay', value: 'no' },
      { label: 'tourSlots', value: 'Sat, Mar 6, 2027, parts.evening' },
    ]);
  });

  it('reads a caterer and leaves out what they skipped', () => {
    expect(
      leadAnswerRows({ food: 'veg_nonveg', liveStations: ['chaat', 'chai'], tasting: true }, t),
    ).toEqual([
      { label: 'food', value: 'foodVegNonVeg' },
      { label: 'liveStations', value: 'stations.chaat, stations.chai' },
      { label: 'tasting', value: 'yes' },
    ]);
    expect(leadAnswerRows({ food: 'pizza', mystery: 1 }, t)).toEqual([]);
  });
});
