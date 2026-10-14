// What a push alert for a chat message says (push-chat). Kept apart from
// index.ts so it can be tested without starting the server.

export type PushClaim = {
  message_id: string;
  conversation_id: string;
  recipient_side: 'family' | 'vendor';
  tokens: string[];
  title: string;
  kind: string;
  body: string | null;
  data: Record<string, unknown>;
  event_names: string[];
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: { conversationId: string; url: string };
  sound: 'default';
  channelId: 'messages';
  priority: 'high';
};

function shorten(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** "2027-06-12" as "Sat, Jun 12, 2027". */
function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** What the alert says under the title, for each kind of message. */
export function pushBody(claim: Pick<PushClaim, 'kind' | 'body' | 'data' | 'event_names'>): string {
  const caption = claim.body ? `: ${shorten(claim.body, 100)}` : '';
  switch (claim.kind) {
    case 'text':
      return shorten(claim.body ?? '');
    case 'photo':
      return `📷 Photo${caption}`;
    case 'voice':
      return '🎤 Voice note';
    case 'deposit': {
      const update = claim.data.update;
      if (update === 'paid') return '✅ Deposit paid';
      if (update === 'refunded') return 'Deposit refunded';
      return '💳 Asked for a deposit';
    }
    case 'quote':
      return 'Sent you a price quote';
    case 'menu':
      return 'Shared a menu';
    case 'phone':
      // Never the number itself on a lock screen
      return 'Shared their phone number';
    case 'booking': {
      const details = claim.data.details as Record<string, unknown> | undefined;
      const what = details?.tour === true ? 'Tour request' : 'New request';
      const events = claim.event_names.length > 0 ? claim.event_names.join(', ') : 'Wedding';
      const date = typeof claim.data.eventDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(claim.data.eventDate)
        ? ` · ${formatDate(claim.data.eventDate)}`
        : '';
      return `${what}: ${events}${date}`;
    }
    default:
      return 'Sent you a message';
  }
}

/** One alert per phone for a claimed message. */
export function buildPushes(claim: PushClaim): PushMessage[] {
  const body = pushBody(claim);
  return claim.tokens.map((to) => ({
    to,
    title: claim.title,
    body,
    data: { conversationId: claim.conversation_id, url: `/chat/${claim.conversation_id}` },
    sound: 'default',
    channelId: 'messages',
    priority: 'high',
  }));
}
