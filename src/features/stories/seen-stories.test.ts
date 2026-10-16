import type { StoryGroup } from '@/data/stories';

import { groupSeen, trayOrder } from './seen-stories';

jest.mock('@/lib/storage', () => ({
  readSetting: () => null,
  writeSetting: async () => {},
  StorageKeys: { seenStories: 'stories.seen' },
}));

const group = (key: string, ids: string[], isMine = false) =>
  ({ key, isMine, stories: ids.map((id) => ({ id })) }) as unknown as StoryGroup;

describe('trayOrder', () => {
  it('puts yours first, then new stories, then the ones already watched', () => {
    const watched = new Set(['w1', 'p1']);
    const seen = (id: string) => watched.has(id);
    const order = trayOrder(
      [group('watched', ['w1']), group('mine', ['m1'], true), group('part', ['p1', 'p2'])],
      seen,
    );
    expect(order.map((g) => g.key)).toEqual(['mine', 'part', 'watched']);
    expect(groupSeen(group('part', ['p1', 'p2']), seen)).toBe(false);
  });
});
