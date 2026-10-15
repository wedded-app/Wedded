import { searchVendors } from './search';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
      }),
    },
  },
}));

const row = {
  id: 'v1',
  slug: 'gabru-dhol-crew',
  name: 'Gabru Dhol Crew',
  city: 'Manteca',
  primary_category_slug: 'dhol',
  primary_category_name: { en: 'Dhol player' },
  price_display: 'starting_at',
  price_from: 400,
  price_to: null,
  price_unit: 'event',
  founding_number: null,
  distance_miles: 12.4,
  within_search_radius: true,
  latitude: 37.8,
  longitude: -121.2,
  cover_path: 'v1/p1',
};

beforeEach(() => mockRpc.mockReset());

describe('searchVendors', () => {
  it('passes the search to the database and shapes results for VendorCard', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    const [result] = await searchVendors({
      latitude: 37.8,
      longitude: -121.2,
      categorySlug: 'dhol',
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'search_vendors',
      expect.objectContaining({
        lat: 37.8,
        lng: -121.2,
        max_miles: 25,
        category_slug: 'dhol',
        include_travelers: false,
      }),
    );
    expect(result).toMatchObject({
      name: { en: 'Gabru Dhol Crew' },
      category: { en: 'Dhol player' },
      startingPrice: { amount: 400, unit: 'event' },
      distanceMiles: 12.4,
      photoUrl: 'https://cdn/v1/p1/400.webp',
    });
  });

  it('sends null for anywhere, and handles vendors with no price, photo or distance', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          ...row,
          price_display: 'hidden',
          distance_miles: null,
          cover_path: null,
        },
      ],
      error: null,
    });
    const [result] = await searchVendors({ maxMiles: null });

    expect(mockRpc).toHaveBeenCalledWith(
      'search_vendors',
      expect.objectContaining({ max_miles: null }),
    );
    expect(result).toMatchObject({
      name: { en: 'Gabru Dhol Crew' },
      startingPrice: null,
      distanceMiles: null,
      photoUrl: null,
    });
  });

  it('throws database errors so the screen can show Try again', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(searchVendors({})).rejects.toThrow('offline');
  });
});
