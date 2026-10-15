import { toMenu } from './vendor-menus';
import {
  emptyMenuDraft,
  groupMarks,
  menuProblem,
  menuRow,
  menuToDraft,
  monthRange,
} from './vendor-self';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('menu drafts', () => {
  it('trims, turns blanks into null and drops empty rows', () => {
    const row = menuRow({
      ...emptyMenuDraft(),
      name: '  Gold ',
      description: '   ',
      price: 45,
      sections: [
        {
          title: 'Mains',
          items: [
            { name: ' Dal makhani ', description: '', dietTags: ['veg'] },
            { name: '  ', description: 'ignored', dietTags: [] },
          ],
        },
        { title: ' ', items: [] },
      ],
    });
    expect(row).toEqual({
      name: 'Gold',
      description: null,
      cuisine: null,
      diet: [],
      price_from: 45,
      price_unit: 'plate',
      min_guests: null,
      sections: [{ title: 'Mains', items: [{ name: 'Dal makhani', diet: ['veg'] }] }],
    });
  });

  it('leaves the unit out without a price', () => {
    expect(menuRow({ ...emptyMenuDraft(), name: 'Gold', unit: 'person' }).price_unit).toBeNull();
  });

  it('says what the database would refuse', () => {
    const ok = { ...emptyMenuDraft(), name: 'Gold' };
    expect(menuProblem(ok)).toBeNull();
    expect(menuProblem({ ...ok, name: ' ' })).toBe('name');
    expect(menuProblem({ ...ok, price: 0 })).toBe('price');
    expect(menuProblem({ ...ok, price: 12.5 })).toBe('price');
    expect(menuProblem({ ...ok, minGuests: -1 })).toBe('minGuests');
    expect(
      menuProblem({
        ...ok,
        sections: [{ title: '', items: [{ name: 'Naan', description: '', dietTags: [] }] }],
      }),
    ).toBe('sectionTitle');
    expect(menuProblem({ ...ok, name: 'x'.repeat(81) })).toBe('tooLong');
  });

  it('round-trips a saved menu through the editor', () => {
    const menu = toMenu({
      id: 'm1',
      name: 'Gold',
      description: null,
      cuisine: 'Punjabi',
      diet: ['halal'],
      price_from: 38,
      price_unit: 'person',
      min_guests: 200,
      sections: [{ title: 'Mains', items: [{ name: 'Biryani', description: 'Hyderabadi' }] }],
    });
    const draft = menuToDraft(menu);
    expect(draft.id).toBe('m1');
    expect(draft.name).toBe('Gold');
    expect(menuRow(draft)).toMatchObject({
      price_from: 38,
      price_unit: 'person',
      min_guests: 200,
      sections: [{ title: 'Mains', items: [{ name: 'Biryani', description: 'Hyderabadi' }] }],
    });
  });
});

describe('calendar', () => {
  it('gives the first and last day of a month', () => {
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('groups marks by day', () => {
    expect(
      groupMarks([
        { day: '2027-06-12', part: 'all_day', status: 'booked' },
        { day: '2027-06-19', part: 'morning', status: 'held' },
        { day: '2027-06-19', part: 'evening', status: 'booked' },
      ]),
    ).toEqual({
      '2027-06-12': [{ part: 'all_day', status: 'booked' }],
      '2027-06-19': [
        { part: 'morning', status: 'held' },
        { part: 'evening', status: 'booked' },
      ],
    });
  });
});
