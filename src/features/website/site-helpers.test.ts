import type { SiteEvent, SitePage } from '@/data/website';

import { capsColor, contrast, SITE_DESIGNS } from './designs';

import {
  cityLine,
  dateRangeLine,
  daysUntil,
  hasContent,
  missingParts,
  slugify,
  splitNames,
  startSteps,
  visibleSections,
} from './site-helpers';

const event = (slug: string, date: string | null, city: string | null = null): SiteEvent => ({
  slug,
  date,
  startsAt: null,
  endsAt: null,
  place: null,
  city,
  dressCode: null,
  dressColors: [],
  note: null,
  shownPublicly: true,
  rsvp: null,
  coming: null,
});

const page = (over: Partial<SitePage> = {}): SitePage => ({
  slug: 'asha-ravi',
  title: 'Asha & Ravi',
  weddingDate: null,
  design: 'classic',
  palette: null,
  coverPath: null,
  welcome: null,
  story: null,
  familyTitle: null,
  familyLines: [],
  guideTitle: null,
  livestreamUrl: null,
  livestreamNote: null,
  rsvpBy: null,
  sections: ['family', 'story', 'events', 'rsvp', 'guide', 'travel', 'livestream', 'faq'],
  searchable: false,
  publishedAt: null,
  rsvpLink: null,
  guest: null,
  events: [],
  tips: [],
  hotels: [],
  faq: [],
  editor: null,
  ...over,
});

describe('dateRangeLine', () => {
  it('spans the events', () => {
    expect(dateRangeLine([event('a', '2027-06-12'), event('b', '2027-06-11')], null)).toBe(
      'June 11–12, 2027',
    );
    expect(dateRangeLine([event('a', '2027-06-30'), event('b', '2027-07-02')], null)).toBe(
      'June 30 – July 2, 2027',
    );
    expect(dateRangeLine([event('a', '2027-12-31'), event('b', '2028-01-01')], null)).toBe(
      'December 31, 2027 – January 1, 2028',
    );
  });

  it('says the day for one, and falls back to the wedding date', () => {
    expect(dateRangeLine([event('a', '2027-06-12'), event('b', '2027-06-12')], null)).toBe(
      'Saturday, June 12, 2027',
    );
    expect(dateRangeLine([event('a', null)], '2027-06-12')).toBe('Saturday, June 12, 2027');
    expect(dateRangeLine([], null)).toBeNull();
  });
});

describe('cityLine', () => {
  it('picks the town most events are in', () => {
    expect(
      cityLine([
        event('a', null, 'Sacramento'),
        event('b', null, 'Yuba City'),
        event('c', null, 'Yuba City'),
      ]),
    ).toBe('Yuba City');
    expect(cityLine([event('a', null)])).toBeNull();
  });
});

describe('daysUntil', () => {
  it('counts whole days from today', () => {
    expect(daysUntil('2027-06-11', new Date(2026, 9, 22, 18, 30))).toBe(232);
    expect(daysUntil('2026-10-22', new Date(2026, 9, 22, 23, 59))).toBe(0);
  });
});

describe('splitNames', () => {
  it('splits a couple on & or and', () => {
    expect(splitNames('Asha & Ravi')).toEqual(['Asha', 'Ravi']);
    expect(splitNames('Asha and Ravi')).toEqual(['Asha', 'Ravi']);
    expect(splitNames('The Gill wedding')).toBeNull();
  });
});

describe('sections', () => {
  it('shows a part only when it is on and has something in it', () => {
    const p = page({
      story: 'We met at college.',
      events: [event('mehndi', null)],
      rsvpLink: 'abc',
      sections: ['events', 'story', 'faq', 'rsvp'],
    });
    expect(visibleSections(p)).toEqual(['events', 'story', 'rsvp']);
    expect(hasContent(page({ events: [event('a', null)] }), 'rsvp')).toBe(false);
  });
});

describe('startSteps and missingParts', () => {
  it('ticks what is done and lists what guests would miss', () => {
    const p = page({
      coverPath: 'w/p',
      events: [{ ...event('mehndi', '2027-06-11'), dressCode: 'Green' }],
    });
    expect(startSteps(p)).toEqual({ design: false, cover: true, dress: true, published: false });
    expect(missingParts(p).map((m) => m.kind)).toEqual([
      'eventPlace',
      'rsvpBy',
      'welcome',
      'published',
    ]);
  });
});

describe('slugify', () => {
  it('makes a link like the database', () => {
    expect(slugify('  Asha & Ravi 2027! ')).toBe('asha-ravi-2027');
  });
});

describe('design colours', () => {
  it('keeps small capitals readable on every page', () => {
    for (const design of SITE_DESIGNS) {
      for (const p of design.palettes) {
        expect(contrast(capsColor(p), p.paper)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.ink, p.paper)).toBeGreaterThanOrEqual(7);
        expect(contrast(p.soft, p.paper)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.onInk, p.ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
