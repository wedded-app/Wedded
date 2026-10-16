import type { ChatMessage } from './chat-types';

/** Messages this close together from the same person share one bubble run. */
const RUN_GAP_MS = 5 * 60 * 1000;

/** What a thread needs of a message. `senderRole` says whose it is: a side, or a person in a group. */
type Threaded = { id: string; createdAt: string; senderRole: string; readAt?: string | null };

export type ThreadItem<M extends Threaded = ChatMessage> =
  | { type: 'day'; key: string; day: string }
  | {
      type: 'message';
      key: string;
      message: M;
      mine: boolean;
      /** First and last of a run from the same person: rounder corners, the time under the last. */
      first: boolean;
      last: boolean;
      /** The newest of my messages the other side has read: "Seen" goes under it. */
      seen: boolean;
    };

/** The calendar day of an ISO time, in this phone's time zone: "2026-09-30". */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A thread as rows to draw, oldest first: a day heading whenever the day
 * changes, then each message marked mine or theirs and where it sits in its run.
 */
export function layoutThread<M extends Threaded>(messages: M[], myRole: string): ThreadItem<M>[] {
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastSeenId = [...sorted]
    .reverse()
    .find((message) => message.senderRole === myRole && message.readAt)?.id;

  const items: ThreadItem<M>[] = [];
  sorted.forEach((message, i) => {
    const day = localDay(message.createdAt);
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (!prev || localDay(prev.createdAt) !== day) {
      items.push({ type: 'day', key: `day-${day}`, day });
    }
    const joins = (other: M | undefined) =>
      !!other &&
      other.senderRole === message.senderRole &&
      localDay(other.createdAt) === day &&
      Math.abs(Date.parse(other.createdAt) - Date.parse(message.createdAt)) <= RUN_GAP_MS;
    items.push({
      type: 'message',
      key: message.id,
      message,
      mine: message.senderRole === myRole,
      first: !joins(prev),
      last: !joins(next),
      seen: message.id === lastSeenId,
    });
  });
  return items;
}

/** "today", "yesterday", or null for an older day (show the date then). */
export function relativeDay(day: string, now: Date = new Date()): 'today' | 'yesterday' | null {
  const today = localDay(now.toISOString());
  const yesterday = localDay(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
  if (day === today) return 'today';
  if (day === yesterday) return 'yesterday';
  return null;
}
