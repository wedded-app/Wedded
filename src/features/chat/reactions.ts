/**
 * Reactions on chat messages (C5c): six emoji, one per person per message.
 * The database stores the names; the app draws the emoji.
 */
export const REACTIONS = [
  { code: 'heart', emoji: '❤️' },
  { code: 'thumbs_up', emoji: '👍' },
  { code: 'laugh', emoji: '😂' },
  { code: 'wow', emoji: '😮' },
  { code: 'sad', emoji: '😢' },
  { code: 'pray', emoji: '🙏' },
] as const;

export type ReactionCode = (typeof REACTIONS)[number]['code'];

/** One reaction as the database row (message_reactions). */
export type ReactionRow = { message_id: string; user_id: string; reaction: string };

/** How a message's reactions show under it: each emoji once, with its count. */
export type ReactionSummary = { code: ReactionCode; emoji: string; count: number; mine: boolean };

export function isReactionCode(value: string): value is ReactionCode {
  return REACTIONS.some((r) => r.code === value);
}

/** Reactions grouped by message, in the picker's order, yours marked. */
export function summarizeReactions(
  rows: ReactionRow[],
  me: string | null,
): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<ReactionCode, ReactionSummary>>();
  for (const row of rows) {
    if (!isReactionCode(row.reaction)) continue;
    const forMessage = byMessage.get(row.message_id) ?? new Map<ReactionCode, ReactionSummary>();
    const emoji = REACTIONS.find((r) => r.code === row.reaction)!.emoji;
    const current = forMessage.get(row.reaction) ?? {
      code: row.reaction,
      emoji,
      count: 0,
      mine: false,
    };
    current.count += 1;
    current.mine ||= row.user_id === me;
    forMessage.set(row.reaction, current);
    byMessage.set(row.message_id, forMessage);
  }
  const ordered = new Map<string, ReactionSummary[]>();
  for (const [messageId, forMessage] of byMessage) {
    ordered.set(
      messageId,
      REACTIONS.map((r) => forMessage.get(r.code)).filter((s): s is ReactionSummary => !!s),
    );
  }
  return ordered;
}

/**
 * Your reaction rows after picking one: replaces yours on that message, or
 * takes it back when it's the one you already have (or null).
 */
export function applyReaction(
  rows: ReactionRow[],
  messageId: string,
  me: string,
  reaction: ReactionCode | null,
): ReactionRow[] {
  const others = rows.filter((r) => !(r.message_id === messageId && r.user_id === me));
  return reaction ? [...others, { message_id: messageId, user_id: me, reaction }] : others;
}

/** What tapping an emoji does: the same one again takes yours back. */
export function nextReaction(
  current: ReactionCode | null,
  picked: ReactionCode,
): ReactionCode | null {
  return current === picked ? null : picked;
}
