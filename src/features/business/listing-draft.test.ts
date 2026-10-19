import type { Listing } from '@/data/listing';

import { draftChanges, listingToDraft, sectionFor } from './listing-draft';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const listing: Listing = {
  name: 'Royal Orchard',
  slug: 'royal-orchard',
  status: 'published',
  city: 'Yuba City',
  tagline: 'Banquet hall for 600',
  bio: null,
  priceDisplay: 'starting_at',
  priceFrom: 5000,
  priceTo: null,
  priceUnit: 'event',
  priceNote: null,
  callPhone: '+15305550101',
  textPhone: null,
  whatsappPhone: null,
  preferredContact: 'call',
  instagramHandle: null,
  websiteUrl: null,
  languages: ['en', 'pa'],
  yearsInBusiness: 12,
  teamSize: null,
  serviceRadiusMiles: null,
  willTravel: false,
  travelNote: null,
  officeHours: null,
};

describe('listing editor', () => {
  it('sends nothing when nothing changed', () => {
    expect(draftChanges(listing, listingToDraft(listing))).toEqual({ changes: {}, problem: null });
  });

  it('sends only what changed, and blanks as null', () => {
    const draft = {
      ...listingToDraft(listing),
      tagline: '  ',
      bio: 'Our hall',
      whatsappPhone: '(530) 555-0199',
      languages: ['pa', 'en', 'hi'],
    };
    expect(draftChanges(listing, draft)).toEqual({
      changes: {
        tagline: null,
        bio: 'Our hall',
        whatsappPhone: '+15305550199',
        languages: ['pa', 'en', 'hi'],
      },
      problem: null,
    });
  });

  it('checks prices the way the database does', () => {
    const base = listingToDraft(listing);
    expect(draftChanges(listing, { ...base, priceFrom: '0' }).problem).toEqual({
      field: 'priceFrom',
      kind: 'priceFrom',
    });
    expect(
      draftChanges(listing, { ...base, priceDisplay: 'range', priceFrom: '900', priceTo: '500' })
        .problem,
    ).toEqual({ field: 'priceTo', kind: 'priceTo' });
    expect(draftChanges(listing, { ...base, priceUnit: null }).problem?.kind).toBe('priceUnit');
    // "Ask me" clears the amounts
    expect(draftChanges(listing, { ...base, priceDisplay: 'contact' }).changes).toEqual({
      priceDisplay: 'contact',
      priceFrom: null,
      priceUnit: null,
    });
    expect(draftChanges(listing, { ...base, priceFrom: '$6,500' }).changes).toEqual({
      priceFrom: 6500,
    });
  });

  it('refuses a bad phone, no languages, and too-long text', () => {
    const base = listingToDraft(listing);
    expect(draftChanges(listing, { ...base, textPhone: '12' }).problem?.field).toBe('textPhone');
    expect(draftChanges(listing, { ...base, languages: [] }).problem?.kind).toBe('languages');
    expect(draftChanges(listing, { ...base, tagline: 'x'.repeat(121) }).problem?.kind).toBe(
      'taglineLong',
    );
  });

  it('opens Fix it at the right section', () => {
    expect(sectionFor('bio')).toBe('about');
    expect(sectionFor('instagram')).toBe('contact');
    expect(sectionFor('photos')).toBeNull();
  });
});
