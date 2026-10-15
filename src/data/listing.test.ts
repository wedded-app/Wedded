import { listingChanges, listingProblem, toListing, type Listing } from './listing';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ session: null }) }));

const saved: Listing = toListing({
  name: 'Edit Dhol',
  slug: 'edit-dhol',
  status: 'published',
  city: 'Yuba City',
  tagline: 'Dhol for every baraat',
  bio: null,
  priceDisplay: 'starting_at',
  priceFrom: 450,
  priceTo: null,
  priceUnit: 'event',
  priceNote: null,
  callPhone: null,
  textPhone: null,
  whatsappPhone: '+15305550111',
  preferredContact: 'whatsapp',
  instagramHandle: 'edit.dhol',
  websiteUrl: null,
  languages: ['pa', 'en'],
  yearsInBusiness: null,
  teamSize: null,
  serviceRadiusMiles: 50,
  willTravel: true,
  travelNote: null,
  officeHours: null,
});

describe('toListing', () => {
  it('fills languages and travel when missing', () => {
    const listing = toListing({ name: 'x', languages: null, willTravel: null });
    expect(listing.languages).toEqual([]);
    expect(listing.willTravel).toBe(false);
  });
});

describe('listingChanges', () => {
  it('sends only what changed', () => {
    expect(
      listingChanges(saved, {
        tagline: 'Dhol for every baraat',
        bio: 'Three generations.',
        priceFrom: 450,
        languages: ['pa', 'en'],
        willTravel: true,
      }),
    ).toEqual({ bio: 'Three generations.' });
  });

  it('trims text, treats an empty box as cleared, and spots reordered languages', () => {
    expect(
      listingChanges(saved, {
        tagline: '  Dhol for every baraat ',
        instagramHandle: '   ',
        languages: ['en', 'pa'],
      }),
    ).toEqual({ instagramHandle: null, languages: ['en', 'pa'] });
  });
});

describe('listingProblem', () => {
  it('names the field the database refused', () => {
    expect(listingProblem(new Error('invalid_field:callPhone'))).toEqual({
      field: 'callPhone',
      kind: 'invalid',
    });
    expect(listingProblem(new Error('invalid_field:number'))).toEqual({
      field: null,
      kind: 'invalid',
    });
  });

  it('tells apart not allowed and other failures', () => {
    expect(listingProblem(new Error('not_editable:name')).kind).toBe('notAllowed');
    expect(listingProblem(new Error('not_allowed')).kind).toBe('notAllowed');
    expect(listingProblem(new Error('Network request failed')).kind).toBe('failed');
  });
});
