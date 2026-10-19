import { guestBand, planFromQuery } from './plan-from-query';

const data = {
  backgrounds: [
    { slug: 'punjabi', name: { en: 'Punjab' } },
    { slug: 'pakistani', name: { en: 'Pakistan' } },
    { slug: 'arab', name: { en: 'Middle East' } },
  ],
  faiths: [
    { slug: 'sikh', name: { en: 'Sikh' } },
    { slug: 'muslim', name: { en: 'Muslim' } },
  ],
  events: [
    { slug: 'mehndi', names: ['Mehndi', 'Henna night'] },
    { slug: 'maiyan', names: ['Maiyan / Vatna', 'Mayun'] },
    { slug: 'anand-karaj', names: ['Anand Karaj + Laavan'] },
    { slug: 'nikah', names: ['Nikah'] },
  ],
  cities: [
    { slug: 'yuba-city', name: 'Yuba City', areaCode: '530', nicknames: ['yuba'] },
    { slug: 'sacramento', name: 'Sacramento', areaCode: '916', nicknames: ['sac'] },
  ],
};

describe('planFromQuery', () => {
  it('reads a whole wedding from one sentence', () => {
    expect(
      planFromQuery('Punjabi Sikh wedding in Yuba City for 300 people on June 12, 2027', data),
    ).toEqual({
      backgrounds: ['punjabi'],
      faiths: ['sikh'],
      events: [],
      guestBand: '250_500',
      city: { slug: 'yuba-city', areaCode: '530' },
      date: '2027-06-12',
    });
  });

  it('knows the Punjabi and Urdu words for a wedding', () => {
    expect(planFromQuery('shaadi', data)).not.toBeNull();
    expect(planFromQuery('viah', data)).not.toBeNull();
    expect(planFromQuery('pakistani shadi sac', data)).toMatchObject({
      backgrounds: ['pakistani'],
      city: { slug: 'sacramento' },
    });
  });

  it('finds events by any name a tradition gives them, and each part of a name', () => {
    expect(planFromQuery('mayun and henna night in sacramento', data)?.events).toEqual([
      'mehndi',
      'maiyan',
    ]);
    expect(planFromQuery('wedding with anand karaj', data)?.events).toEqual(['anand-karaj']);
  });

  it('leaves a plain vendor search alone', () => {
    expect(planFromQuery('mehndi', data)).toBeNull();
    expect(planFromQuery('dhol player', data)).toBeNull();
    expect(planFromQuery('punjabi caterer', data)).toBeNull();
    expect(planFromQuery('', data)).toBeNull();
  });

  it('plans when an event comes with another detail', () => {
    expect(planFromQuery('nikah for 150 guests', data)).toMatchObject({
      events: ['nikah'],
      guestBand: '100_250',
    });
  });

  it('reads dates written different ways, and skips ones that do not exist', () => {
    expect(planFromQuery('wedding 6/12/27', data)?.date).toBe('2027-06-12');
    expect(planFromQuery('wedding 12th june 2027', data)?.date).toBe('2027-06-12');
    expect(planFromQuery('wedding feb 30 2027', data)?.date).toBeNull();
  });

  it('never takes a year for a guest count', () => {
    expect(planFromQuery('wedding for 2027', data)?.guestBand).toBeNull();
    expect(planFromQuery('wedding 80 guests', data)?.guestBand).toBe('50_100');
  });
});

describe('guestBand', () => {
  it('puts a count in the inquiry form bands', () => {
    expect(guestBand(40)).toBe('under_50');
    expect(guestBand(100)).toBe('50_100');
    expect(guestBand(250)).toBe('100_250');
    expect(guestBand(500)).toBe('250_500');
    expect(guestBand(800)).toBe('500_plus');
  });
});
