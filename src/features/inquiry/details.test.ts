import {
  catererDetails,
  emptyCatererAnswers,
  emptyVenueAnswers,
  venueAnswersFrom,
  venueDetails,
} from './details';

describe('venueDetails', () => {
  it('sends nothing when nothing was answered', () => {
    expect(venueDetails(emptyVenueAnswers(), false)).toEqual({});
  });

  it('sends only what was answered, and the caterer name only when bringing their own', () => {
    expect(
      venueDetails(
        { ...emptyVenueAnswers(), catering: 'in_house', ownCaterer: 'ignored', ghoriDhol: false },
        false,
      ),
    ).toEqual({ catering: 'in_house', ghoriDhol: false });
    expect(
      venueDetails({ ...emptyVenueAnswers(), catering: 'own', ownCaterer: ' Saffron ' }, false),
    ).toEqual({ catering: 'own', ownCaterer: 'Saffron' });
  });

  it('marks a tour and keeps only visit times with a date', () => {
    expect(
      venueDetails(
        {
          ...emptyVenueAnswers(),
          tourSlots: [
            { date: '2026-10-03', part: 'evening' },
            { date: null, part: 'morning' },
          ],
        },
        true,
      ),
    ).toEqual({ tour: true, tourSlots: [{ date: '2026-10-03', part: 'evening' }] });
  });
});

describe('venueAnswersFrom', () => {
  it('gives back what venueDetails sent', () => {
    const answers = {
      ...emptyVenueAnswers(),
      catering: 'own' as const,
      ownCaterer: 'Saffron',
      sameDay: true,
      tourSlots: [{ date: '2026-10-03', part: 'evening' as const }],
    };
    expect(venueAnswersFrom(venueDetails(answers, true), '2026-10-01')).toEqual(answers);
  });

  it('leaves anything unexpected blank', () => {
    expect(venueAnswersFrom(null, '2026-10-01')).toEqual(emptyVenueAnswers());
    expect(
      venueAnswersFrom(
        {
          catering: 'buffet',
          ghoriDhol: 'yes',
          tourSlots: [{ date: 3, part: 'evening' }, { date: '2026-10-04', part: 'night' }, 'x'],
        },
        '2026-10-01',
      ),
    ).toEqual(emptyVenueAnswers());
  });

  it('keeps only visit times on real days, today or later', () => {
    const slots = [
      { date: '2026-09-30', part: 'morning' },
      { date: '2026-10-01', part: 'evening' },
      { date: '2026-02-30', part: 'evening' },
      { date: 'tomorrow', part: 'evening' },
      { date: '2026-12-05', part: 'afternoon' },
    ];
    expect(venueAnswersFrom({ tourSlots: slots }, '2026-10-01').tourSlots).toEqual([
      { date: '2026-10-01', part: 'evening' },
    ]);
  });
});

describe('catererDetails', () => {
  it('sends only what was answered', () => {
    expect(catererDetails(emptyCatererAnswers())).toEqual({});
    expect(
      catererDetails({
        food: 'jhatka',
        liveStations: ['tandoor'],
        hall: ' Royal Orchard ',
        tasting: true,
      }),
    ).toEqual({ food: 'jhatka', liveStations: ['tandoor'], hall: 'Royal Orchard', tasting: true });
  });
});
