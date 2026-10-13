import type { Conversation } from '@/data/chat';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** A message as one plain line: its words, or what it is ("Photo", "Sent a quote"). */
export function messageSnippet(
  message: { kind: string; body: string | null },
  t: Translate,
): string {
  switch (message.kind) {
    case 'photo':
      return t('chat.preview.photo');
    case 'quote':
      return t('chat.preview.quote');
    case 'menu':
      return t('chat.preview.menu');
    case 'booking':
      return t('chat.preview.booking');
    case 'phone':
      return t('chat.preview.phone');
    default:
      return (message.body ?? '').replace(/\s+/g, ' ').trim();
  }
}

/** A conversation's last message as one line for the inbox. */
export function lastMessagePreview(conversation: Conversation, t: Translate): string {
  const last = conversation.lastMessage;
  if (!last) return t('chat.noMessages');
  const text = messageSnippet(last, t);
  return last.senderRole === conversation.side ? t('chat.preview.you', { text }) : text;
}

/** "2:05 PM" today, "Yesterday", or "Sep 12" for older ones. */
export function inboxTime(iso: string, t: Translate, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  }
  if (sameDay(d, new Date(now.getTime() - 24 * 60 * 60 * 1000))) return t('chat.yesterday');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}
