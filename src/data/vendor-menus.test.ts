import { cheapestMenu, toMenu } from './vendor-menus';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const row = {
  id: 'm1',
  name: 'Gold Package',
  description: 'Five appetizers',
  cuisine: 'Punjabi',
  diet: ['veg', 'halal', 'nonsense'],
  price_from: 38,
  price_unit: 'plate',
  min_guests: 200,
  sections: [
    {
      title: 'Mains',
      items: [
        { name: 'Kadhai paneer', diet: ['veg'] },
        { name: 'Biryani', description: 'Hyderabadi' },
      ],
    },
  ],
};

describe('menus', () => {
  it('turns a row into what the screens show', () => {
    const menu = toMenu(row);
    expect(menu.name).toEqual({ en: 'Gold Package' });
    expect(menu.price).toEqual({ amount: 38, unit: 'plate' });
    expect(menu.dietTags).toEqual(['veg', 'halal']);
    expect(menu.sections[0].name).toEqual({ en: 'Mains' });
    expect(menu.sections[0].items[1]).toEqual({
      name: { en: 'Biryani' },
      description: 'Hyderabadi',
      dietTags: [],
    });
  });

  it('finds the cheapest price for "Menus from"', () => {
    const cheap = toMenu({ ...row, id: 'm2', price_from: 22 });
    const noPrice = toMenu({ ...row, id: 'm3', price_from: null, price_unit: null });
    expect(cheapestMenu([toMenu(row), cheap, noPrice])).toEqual({ amount: 22, unit: 'plate' });
    expect(cheapestMenu([noPrice])).toBeNull();
  });
});
