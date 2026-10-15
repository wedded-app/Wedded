import type { Approval, ChatItem } from './wed-store';

export type PreviewMessage = { id: string; text: string; at: number; from: 'family' | 'vendor' };
export type PreviewConversation = {
  id: string;
  name: string;
  photo?: string;
  messages: PreviewMessage[];
  updatedAt: number;
};

/** Project the same approved demo actions into Chats; never contact a real vendor. */
export function previewConversations(
  approvals: readonly Approval[],
  items: readonly ChatItem[],
): PreviewConversation[] {
  const conversations = new Map<string, PreviewConversation>();
  for (const approval of approvals) {
    if (
      approval.stage !== 'done' ||
      approval.chose === 'alt' ||
      approval.preview ||
      !['ask', 'message', 'tour'].includes(approval.kind) ||
      !approval.message
    )
      continue;
    for (const recipient of approval.to) {
      const id = recipient.name
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-');
      const conversation = conversations.get(id) ?? {
        id,
        name: recipient.name,
        photo: recipient.photo,
        messages: [],
        updatedAt: 0,
      };
      conversation.messages.push({
        id: `${approval.id}:${id}`,
        text: approval.message,
        at: approval.doneAt ?? approval.createdAt,
        from: 'family',
      });
      conversations.set(id, conversation);
    }
  }
  for (const conversation of conversations.values()) {
    const firstSent = Math.min(...conversation.messages.map((message) => message.at));
    for (const item of items) {
      if (item.kind === 'reply' && item.vendor.name === conversation.name && item.at >= firstSent) {
        conversation.messages.push({ id: item.key, text: item.text, at: item.at, from: 'vendor' });
      }
    }
    conversation.messages.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    conversation.updatedAt = conversation.messages.at(-1)?.at ?? 0;
  }
  return [...conversations.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name),
  );
}
