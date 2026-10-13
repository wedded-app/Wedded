import type { Conversation } from '@/data/chat';

import { inboxTime, lastMessagePreview, messageSnippet } from './chat-format';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const t = (key: string, options?: Record<string, string | number>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

const convo = (lastMessage: Conversation['lastMessage'], side: 'family' | 'vendor' = 'family') =>
  ({
    id: 'c',
    side,
    vendor: { id: 'v', slug: 'v', name: { en: 'V' }, photoUrl: null },
    family: { firstName: 'Harjit' },
    lastMessage,
    unreadCount: 0,
    updatedAt: '2026-09-30T10:00:00Z',
    otherReadAt: null,
  }) as Conversation;

describe('lastMessagePreview', () => {
  it('shows their text as is, flattened to one line', () => {
    expect(
      lastMessagePreview(convo({ kind: 'text', body: 'Yes,\n open', senderRole: 'vendor' }), t),
    ).toBe('Yes, open');
  });

  it('prefixes my own last message with You', () => {
    expect(lastMessagePreview(convo({ kind: 'text', body: 'Hi', senderRole: 'family' }), t)).toBe(
      'chat.preview.you {"text":"Hi"}',
    );
  });

  it('names cards and photos instead of showing empty text', () => {
    expect(lastMessagePreview(convo({ kind: 'quote', body: null, senderRole: 'vendor' }), t)).toBe(
      'chat.preview.quote',
    );
    expect(lastMessagePreview(convo(null), t)).toBe('chat.noMessages');
  });

  it('never shows a shared number in the inbox, only that it was shared', () => {
    expect(lastMessagePreview(convo({ kind: 'phone', body: null, senderRole: 'family' }), t)).toBe(
      'chat.preview.you {"text":"chat.preview.phone"}',
    );
  });
});

describe('messageSnippet', () => {
  it('quotes a message as one line: its words, or what it is', () => {
    expect(messageSnippet({ kind: 'text', body: 'Is June 12\n  open?' }, t)).toBe(
      'Is June 12 open?',
    );
    expect(messageSnippet({ kind: 'photo', body: null }, t)).toBe('chat.preview.photo');
    expect(messageSnippet({ kind: 'booking', body: 'Price?' }, t)).toBe('chat.preview.booking');
  });
});

describe('inboxTime', () => {
  const now = new Date(2026, 8, 30, 15);
  it('uses the time today, Yesterday, then the date', () => {
    expect(inboxTime(new Date(2026, 8, 30, 9, 5).toISOString(), t, now)).toBe('9:05 AM');
    expect(inboxTime(new Date(2026, 8, 29, 20).toISOString(), t, now)).toBe('chat.yesterday');
    expect(inboxTime(new Date(2026, 8, 12, 20).toISOString(), t, now)).toBe('Sep 12');
  });
});
