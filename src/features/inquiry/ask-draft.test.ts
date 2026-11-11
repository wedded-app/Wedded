import {
  answersFromDetails,
  askDetails,
  EMPTY_DRAFT,
  foodOf,
  toggleVisitDay,
  type AskDraft,
} from './ask-draft';

const draft = (patch: Partial<AskDraft>): AskDraft => ({
  ...EMPTY_DRAFT,
  vendorId: 'v1',
  ...patch,
});

describe('foodOf', () => {
  it('is the one food answer the booking sheet prints', () => {
    expect(foodOf(null, null)).toBeNull();
    expect(foodOf('veg', 'halal')).toBe('veg');
    expect(foodOf('nonveg', null)).toBe('veg_nonveg');
    expect(foodOf('nonveg', 'either')).toBe('veg_nonveg');
    expect(foodOf('nonveg', 'jhatka')).toBe('jhatka');
    expect(foodOf('nonveg', 'halal')).toBe('halal');
  });
});

describe('askDetails', () => {
  it("sends a hall's answers in the booking sheet's keys", () => {
    expect(
      askDetails(
        draft({ timeOfDay: 'evening', whoCooks: 'own', alcohol: 'yes', baraat: true }),
        'venue',
      ),
    ).toEqual({ timeOfDay: 'evening', catering: 'own', alcohol: 'yes', ghoriDhol: true });
  });

  it("sends the menu only when the hall's kitchen is cooking", () => {
    const menu = { menu: 'nonveg' as const, meat: 'jhatka' as const, liveCounters: ['tandoor'] };
    expect(askDetails(draft({ ...menu, whoCooks: 'own' }), 'venue')).toEqual({ catering: 'own' });
    expect(askDetails(draft({ ...menu, whoCooks: 'kitchen' }), 'venue')).toEqual({
      catering: 'in_house',
      food: 'jhatka',
      liveStations: ['tandoor'],
    });
  });

  it("sends a caterer's menu and tasting, and only the time of day for anyone else", () => {
    const answers = draft({ timeOfDay: 'both', menu: 'veg', tasting: true, alcohol: 'no' });
    expect(askDetails(answers, 'caterer')).toEqual({
      timeOfDay: 'both',
      food: 'veg',
      tasting: true,
    });
    expect(askDetails(answers, null)).toEqual({ timeOfDay: 'both' });
  });

  it('sends a visit as the days they could come', () => {
    expect(
      askDetails(
        draft({
          tour: true,
          visitDays: ['2026-11-14', '2026-11-16'],
          visitPart: 'morning',
          baraat: true,
        }),
        'venue',
      ),
    ).toEqual({
      tour: true,
      tourSlots: [
        { date: '2026-11-14', part: 'morning' },
        { date: '2026-11-16', part: 'morning' },
      ],
    });
  });

  it('leaves out what they never answered', () => {
    expect(askDetails(draft({}), 'venue')).toEqual({});
  });
});

describe('answersFromDetails', () => {
  const today = '2026-11-11';

  it("brings back last time's answers for Ask again", () => {
    expect(
      answersFromDetails(
        {
          timeOfDay: 'day',
          catering: 'in_house',
          food: 'halal',
          liveStations: ['chai', 'fireworks'],
          alcohol: 'not_sure',
          ghoriDhol: false,
          tasting: true,
        },
        today,
      ),
    ).toEqual({
      timeOfDay: 'day',
      whoCooks: 'kitchen',
      menu: 'nonveg',
      meat: 'halal',
      liveCounters: ['chai'],
      alcohol: 'not_sure',
      baraat: false,
      tasting: true,
    });
  });

  it("reads the older form's same-day answer as Both", () => {
    expect(answersFromDetails({ sameDay: true }, today)).toEqual({ timeOfDay: 'both' });
    expect(answersFromDetails({ sameDay: false }, today)).toEqual({});
  });

  it('keeps only visit days still ahead, and at most three', () => {
    expect(
      answersFromDetails(
        {
          tourSlots: [
            { date: '2026-11-10', part: 'morning' },
            { date: '2026-11-12', part: 'evening' },
            { date: '2026-02-30', part: 'evening' },
            { date: '2026-11-13', part: 'evening' },
            { date: '2026-11-14', part: 'evening' },
            { date: '2026-11-15', part: 'evening' },
          ],
        },
        today,
      ),
    ).toEqual({
      visitDays: ['2026-11-12', '2026-11-13', '2026-11-14'],
      visitPart: 'evening',
    });
  });

  it('ignores anything unexpected from the link', () => {
    expect(answersFromDetails(null, today)).toEqual({});
    expect(answersFromDetails('nonsense', today)).toEqual({});
    expect(answersFromDetails({ catering: 'pizza', alcohol: 7, ghoriDhol: 'yes' }, today)).toEqual(
      {},
    );
  });
});

describe('toggleVisitDay', () => {
  it('adds days in order, takes them off, and stops at three', () => {
    expect(toggleVisitDay([], '2026-11-16')).toEqual(['2026-11-16']);
    expect(toggleVisitDay(['2026-11-16'], '2026-11-14')).toEqual(['2026-11-14', '2026-11-16']);
    expect(toggleVisitDay(['2026-11-14', '2026-11-16'], '2026-11-14')).toEqual(['2026-11-16']);
    const three = ['2026-11-12', '2026-11-13', '2026-11-14'];
    expect(toggleVisitDay(three, '2026-11-20')).toEqual(three);
  });
});
