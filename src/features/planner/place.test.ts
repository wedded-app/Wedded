import { AT_HOME, bookedVenueName, placeKind, placeToSave } from './place';

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
