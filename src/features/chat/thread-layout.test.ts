import type { ChatMessage } from './chat-types';
import { layoutThread, localDay, relativeDay } from './thread-layout';

const message = (id: string, role: 'family' | 'vendor', at: string, readAt: string | null = null) =>
  ({
    id,
    conversationId: 'c',
    senderId: role,
    senderRole: role,
    kind: 'text',
    body: id,
    photoPath: null,
    quote: null,
    menuId: null,
    booking: null,
    phone: null,
    voice: null,
    replyTo: null,
    reactions: [],
    createdAt: at,
    readAt,
  }) satisfies ChatMessage;

// Local times, so the day headings don't depend on the test machine's zone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

describe('layoutThread', () => {
  const items = layoutThread(
    [
      message('b', 'family', at(29, 10, 2)),
      message('a', 'family', at(29, 10, 0), at(29, 11)),
      message('c', 'vendor', at(29, 11)),
      message('d', 'family', at(30, 9), at(30, 9, 30)),
      message('e', 'family', at(30, 9, 20)),
    ],
    'family',
  );
  const rows = items.map((item) =>
    item.type === 'day' ? `day ${item.day}` : `${item.key}${item.mine ? ' mine' : ''}`,
  );

  it('sorts oldest first and puts a heading before each new day', () => {
    expect(rows).toEqual([
      'day 2026-09-29',
      'a mine',
      'b mine',
      'c',
      'day 2026-09-30',
      'd mine',
      'e mine',
    ]);
  });

  it('groups messages from the same person within five minutes into one run', () => {
    const flags = items.flatMap((item) =>
      item.type === 'message'
        ? [`${item.key}:${item.first ? 'F' : ''}${item.last ? 'L' : ''}`]
        : [],
    );
    expect(flags).toEqual(['a:F', 'b:L', 'c:FL', 'd:FL', 'e:FL']);
  });

  it('puts Seen under the newest of my messages that was read', () => {
    const seen = items
      .filter((item) => item.type === 'message' && item.seen)
      .map((item) => item.key);
    expect(seen).toEqual(['d']);
  });
});

describe('relativeDay', () => {
  const now = new Date(2026, 8, 30, 12);
  it('names today and yesterday and leaves older days to the date', () => {
    expect(relativeDay(localDay(now.toISOString()), now)).toBe('today');
    expect(relativeDay(localDay(new Date(2026, 8, 29, 23).toISOString()), now)).toBe('yesterday');
    expect(relativeDay('2026-09-01', now)).toBeNull();
  });
});
