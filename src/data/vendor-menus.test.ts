import { cheapestMenu, toMenu } from './vendor-menus';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const row = {
  id: 'm1',
  name: 'Gold Package',
  description: 'Five appetizers',
  cuisine: 'Punjabi',
  diet_tags: ['veg', 'halal', 'nonsense'],
  price_from_cents: 3800,
  price_unit: 'plate',
  min_guests: 200,
  // Out of order on purpose: dishes come back in sort_order, under their sections
  menu_items: [
    { section: 'Dessert', name: 'Kheer', description: null, diet_tags: [], sort_order: 3 },
    {
      section: 'Mains',
      name: 'Kadhai paneer',
      description: null,
      diet_tags: ['veg'],
      sort_order: 1,
    },
    { section: 'Mains', name: 'Biryani', description: 'Hyderabadi', diet_tags: [], sort_order: 2 },
  ],
};

describe('menus', () => {
  it('turns a row into what the screens show, the price in dollars and dishes under sections', () => {
    const menu = toMenu(row);
    expect(menu.name).toEqual({ en: 'Gold Package' });
    expect(menu.price).toEqual({ amount: 38, unit: 'plate' });
    expect(menu.dietTags).toEqual(['veg', 'halal']);
    expect(menu.sections.map((s) => s.name.en)).toEqual(['Mains', 'Dessert']);
    expect(menu.sections[0].name).toEqual({ en: 'Mains' });
    expect(menu.sections[0].items[1]).toEqual({
      name: { en: 'Biryani' },
      description: 'Hyderabadi',
      dietTags: [],
    });
  });

  it('finds the cheapest price for "Menus from"', () => {
    const cheap = toMenu({ ...row, id: 'm2', price_from_cents: 2200 });
    const noPrice = toMenu({ ...row, id: 'm3', price_from_cents: null, price_unit: null });
    expect(cheapestMenu([toMenu(row), cheap, noPrice])).toEqual({ amount: 22, unit: 'plate' });
    expect(cheapestMenu([noPrice])).toBeNull();
  });
});
