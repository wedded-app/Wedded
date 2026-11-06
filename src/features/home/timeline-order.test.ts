import { timelineOrder } from './timeline-order';

const events = [
  { slug: 'whole-wedding', phase: 'whole_wedding' },
  { slug: 'mehndi', phase: 'before' },
  { slug: 'nikah', phase: 'wedding_day' },
  { slug: 'walima', phase: 'after' },
];
const slugs = (list: { slug: string }[]) => list.map((event) => event.slug);

describe('timelineOrder', () => {
  it('keeps the ceremony order until every day has a date, with the whole wedding last', () => {
    expect(slugs(timelineOrder(events, { nikah: '2027-06-12' }))).toEqual([
      'mehndi',
      'nikah',
      'walima',
      'whole-wedding',
    ]);
  });

  it('goes by date once every day has one', () => {
    const dates = { mehndi: '2027-06-14', nikah: '2027-06-12', walima: '2027-06-13' };
    expect(slugs(timelineOrder(events, dates))).toEqual([
      'nikah',
      'walima',
      'mehndi',
      'whole-wedding',
    ]);
  });

  it('works with no dates at all', () => {
    expect(slugs(timelineOrder(events, undefined))).toEqual([
      'mehndi',
      'nikah',
      'walima',
      'whole-wedding',
    ]);
  });
});
