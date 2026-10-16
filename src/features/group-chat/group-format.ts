import type { GroupMessage, GroupThread } from '@/data/group-chat';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * Whose a message is, for grouping bubbles into runs: the person, Wed, or
 * (for joined / left lines) nobody's, so a line never joins a run.
 */
export function senderKey(message: GroupMessage): string {
  if (message.sender_role === 'system') return `system:${message.id}`;
  if (message.sender_role === 'wed') return 'wed';
  return message.sender_user_id ?? 'someone';
}

/** The name over someone's messages: theirs, Wed, or "Someone who left". */
export function senderName(
  message: Pick<GroupMessage, 'sender_role' | 'sender_user_id'>,
  names: Map<string, string | null>,
  t: Translate,
): string {
  if (message.sender_role === 'wed') return t('groupChat.wed');
  const name = message.sender_user_id ? names.get(message.sender_user_id) : null;
  return name?.trim() || t('groupChat.formerMember');
}

/** The thread list's second line: "Harjit Kaur: See you at 6", "Wed: …", or a joined line. */
export function groupPreview(thread: GroupThread, t: Translate): string {
  if (!thread.lastKind) return t('groupChat.noMessages');
  const name =
    thread.lastSenderRole === 'wed'
      ? t('groupChat.wed')
      : thread.lastSenderIsMe
        ? t('groupChat.you')
        : thread.lastSenderName?.trim() || t('groupChat.formerMember');
  if (thread.lastKind === 'joined' || thread.lastKind === 'left') {
    return t(`groupChat.preview.${thread.lastKind}`, { name });
  }
  if (thread.lastKind === 'photo') return t('groupChat.preview.photo', { name });
  return t('groupChat.preview.text', { name, text: thread.lastBody ?? '' });
}

/** Wed's state for my newest @Wed question: still working, couldn't answer, or nothing to show. */
export function wedState(
  messages: GroupMessage[],
  me: string | null,
): 'thinking' | 'failed' | null {
  const ask = [...messages].reverse().find((m) => m.wed_ask && m.sender_user_id === me);
  if (ask?.wed_ask === 'waiting' || ask?.wed_ask === 'working') return 'thinking';
  if (ask?.wed_ask === 'failed') return 'failed';
  return null;
}
