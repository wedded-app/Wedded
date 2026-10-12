import { applyReaction, nextReaction, summarizeReactions, type ReactionRow } from './reactions';

const rows: ReactionRow[] = [
  { message_id: 'm1', user_id: 'family', reaction: 'heart' },
  { message_id: 'm1', user_id: 'vendor', reaction: 'heart' },
  { message_id: 'm1', user_id: 'aunt', reaction: 'pray' },
  { message_id: 'm2', user_id: 'vendor', reaction: 'thumbs_up' },
  { message_id: 'm2', user_id: 'old', reaction: 'fire' },
];

describe('summarizeReactions', () => {
  it('counts each emoji once per message, in the picker order, marking yours', () => {
    const summary = summarizeReactions(rows, 'family');
    expect(summary.get('m1')).toEqual([
      { code: 'heart', emoji: '❤️', count: 2, mine: true },
      { code: 'pray', emoji: '🙏', count: 1, mine: false },
    ]);
    expect(summary.get('m2')).toEqual([{ code: 'thumbs_up', emoji: '👍', count: 1, mine: false }]);
    expect(summary.get('m3')).toBeUndefined();
  });
});

describe('applyReaction', () => {
  it('replaces your reaction on that message only', () => {
    const next = applyReaction(rows, 'm1', 'family', 'laugh');
    expect(next.filter((r) => r.user_id === 'family')).toEqual([
      { message_id: 'm1', user_id: 'family', reaction: 'laugh' },
    ]);
    expect(next).toHaveLength(rows.length);
  });

  it('takes it back', () => {
    expect(applyReaction(rows, 'm1', 'family', null).some((r) => r.user_id === 'family')).toBe(
      false,
    );
  });
});

describe('nextReaction', () => {
  it('picking your own reaction again takes it back', () => {
    expect(nextReaction('heart', 'heart')).toBeNull();
    expect(nextReaction('heart', 'pray')).toBe('pray');
    expect(nextReaction(null, 'wow')).toBe('wow');
  });
});
