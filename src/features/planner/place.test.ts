import { AT_HOME, bookedVenueName, needsForPlaces, placeKind, placeToSave } from './place';

describe('needsForPlaces', () => {
  const need = (categorySlug: string, groupSlug: string) => ({
    categorySlug,
    groupSlug,
    name: { en: categorySlug },
  });
  const needs = {
    sangeet: [
      {
        importance: 'essential',
        needs: [need('banquet-hall', 'venues'), need('dj', 'music'), need('caterer', 'food')],
      },
      { importance: 'nice_to_have', needs: [need('tent', 'venues')] },
    ],
    nikah: [{ importance: 'essential', needs: [need('mandir-masjid', 'venues')] }],
  };

  it('drops the venues from an event at home, and a section left empty', () => {
    const out = needsForPlaces(needs, { sangeet: AT_HOME });
    expect(out.sangeet).toEqual([
      { importance: 'essential', needs: [need('dj', 'music'), need('caterer', 'food')] },
    ]);
    expect(out.nikah).toBe(needs.nikah);
  });

  it('keeps every need for an event at a venue or with no place', () => {
    expect(needsForPlaces(needs, { sangeet: 'Royal Palace' })).toBe(needs);
    expect(needsForPlaces(needs, {})).toBe(needs);
  });

  it('ignores a place for an event without needs', () => {
    expect(needsForPlaces(needs, { mehndi: AT_HOME })).toBe(needs);
  });
});

describe('bookedVenueName', () => {
  const needs = [
    { categorySlug: 'dj', groupSlug: 'music' },
    { categorySlug: 'banquet-hall', groupSlug: 'venues' },
    { categorySlug: 'gurdwara', groupSlug: 'venues' },
  ];

  it('finds the venue booked for this event', () => {
    const booked = {
      'sangeet/dj': { name: 'DJ Rav' },
      'sangeet/gurdwara': { name: 'Gurdwara Sahib Fremont' },
    };
    expect(bookedVenueName(needs, 'sangeet', booked)).toBe('Gurdwara Sahib Fremont');
  });

  it("ignores other vendors and other events' venues", () => {
    const booked = {
      'sangeet/dj': { name: 'DJ Rav' },
      'reception/banquet-hall': { name: 'Royal Palace' },
    };
    expect(bookedVenueName(needs, 'sangeet', booked)).toBeNull();
  });
});

describe('placeKind', () => {
  it('reads nothing yet as no choice', () => {
    expect(placeKind(null)).toBeNull();
    expect(placeKind(undefined)).toBeNull();
    expect(placeKind('   ')).toBeNull();
  });

  it('reads "At home" and a typed "Home" as Home', () => {
    expect(placeKind(AT_HOME)).toBe('home');
    expect(placeKind(' at home ')).toBe('home');
    expect(placeKind('Home')).toBe('home');
  });

  it('reads anything else as a venue', () => {
    expect(placeKind('Royal Palace Banquet Hall, Fremont')).toBe('venue');
    expect(placeKind('Home Depot parking lot')).toBe('venue');
  });
});

describe('placeToSave', () => {
  it('saves Home as "At home", whatever was typed for a venue', () => {
    expect(placeToSave('home', 'Royal Palace')).toBe(AT_HOME);
  });

  it('saves a venue as its name, tidied', () => {
    expect(placeToSave('venue', '  Royal   Palace,  Fremont ')).toBe('Royal Palace, Fremont');
  });

  it('saves no place for a venue without a name, or no choice', () => {
    expect(placeToSave('venue', '   ')).toBeNull();
    expect(placeToSave(null, 'Royal Palace')).toBeNull();
  });
});
