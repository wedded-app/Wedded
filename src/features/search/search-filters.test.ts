import {
  activeFilterCount,
  clearSearchFilters,
  guestSteps,
  NO_FILTERS,
  priceSteps,
  setSearchFilters,
} from './search-filters';

describe('search filters', () => {
  it('offers per-plate prices for venues and food, per-event prices for the rest', () => {
    expect(priceSteps('venues')).toEqual([25, 40, 60, 80]);
    expect(priceSteps('music')).toEqual([500, 1000, 2500, 5000]);
    expect(priceSteps(null)).toEqual([500, 1000, 2500, 5000]);
  });

  it('counts the filters that are on, not the order', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, minGuests: 400, sort: 'price_low' })).toBe(1);
    expect(
      activeFilterCount({
        minGuests: 400,
        maxPrice: 40,
        language: 'pa',
        availableOn: '2027-06-12',
        sort: 'distance',
      }),
    ).toBe(4);
  });

  it('can be set and cleared', () => {
    setSearchFilters({ language: 'pa' });
    clearSearchFilters();
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it("shows a guest count from the plan that isn't a step, so it reads as picked", () => {
    expect(guestSteps(null)).toEqual([100, 250, 400, 600, 800]);
    expect(guestSteps(250)).toEqual([100, 250, 400, 600, 800]);
    expect(guestSteps(500)).toEqual([100, 250, 400, 500, 600, 800]);
    expect(guestSteps(50)).toEqual([50, 100, 250, 400, 600, 800]);
  });
});
