/**
 * Chat between families and vendors (the chat migration). One conversation
 * per family and vendor; every inquiry adds its booking details to it. Both
 * sides read live through Supabase Realtime. Vendors are people linked to a
 * vendor in vendor_members (npm run vendors:invite); they use the same app.
 *
 * Shapes match the chat components: Conversation, Message.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session';
import {
  applyReaction,
  type ReactionCode,
  type ReactionRow,
  type ReactionSummary,
  summarizeReactions,
} from '@/features/chat/reactions';
import type { LocalizedText } from '@/i18n/localized';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import { photoUrl } from './vendor-media';

export type ChatSide = 'family' | 'vendor';
export type MessageKind =
  'text' | 'photo' | 'quote' | 'menu' | 'booking' | 'phone' | 'voice' | 'deposit';

export type Quote = {
  amount: number;
  unit?: string;
  eventSlug?: string;
  date?: string;
  guests?: string;
  note?: string;
  validUntil?: string;
};

export type Booking = {
  eventSlugs: string[];
  eventDate: string | null;
  startTime: string | null;
  guestBand: string | null;
  location: string | null;
  details: Record<string, unknown>;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderRole: 'family' | 'vendor' | 'system';
  kind: MessageKind;
  body: string | null;
  /** Storage path in chat-media; show it with useChatPhotoUrl(). */
  photoPath: string | null;
  quote: Quote | null;
  menuId: string | null;
  booking: Booking | null;
  /** A family's number, shown only after they tap "Share my number". */
  phone: string | null;
  /** A voice note (C5e): its chat-media path (play it from useChatPhotoUrl()) and length. */
  voice: { path: string; durationMs: number } | null;
  /**
   * A deposit (#209): the vendor's request, or the system's "paid" / "refunded"
   * update to it. Find it with useDeposits() by depositId.
   */
  deposit: { depositId: string; update: 'paid' | 'refunded' | null } | null;
  /** The earlier message this one replies to (swipe to reply), by id. */
  replyTo: string | null;
  createdAt: string;
  /** When the other side had read it (for "Seen"); only on my own messages. */
  readAt: string | null;
  /** Emoji reactions under it, each once with its count (C5c). */
  reactions: ReactionSummary[];
  /** Sent from this phone and not confirmed yet. */
  pending?: boolean;
};

export type Conversation = {
  id: string;
  /** Which side I'm on in this conversation. */
  side: ChatSide;
  vendor: { id: string; slug: string; name: LocalizedText; photoUrl: string | null };
  family: { firstName: string | null };
  lastMessage: { kind: MessageKind; body: string | null; senderRole: string } | null;
  unreadCount: number;
  updatedAt: string;
  /** When the other side last read the conversation. */
  otherReadAt: string | null;
};

export const chatKeys = {
  all: ['chat'] as const,
  conversations: (userId: string) => [...chatKeys.all, 'conversations', userId] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
  reactions: (conversationId: string) => [...chatKeys.all, 'reactions', conversationId] as const,
  vendor: (userId: string) => [...chatKeys.all, 'vendor-of', userId] as const,
};

// Vendor accounts -------------------------------------------------------------------------

/** The vendors the signed-in person runs (usually none: families). */
export function useIsVendor() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const query = useQuery({
    queryKey: chatKeys.vendor(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_members')
        .select('vendor_id')
        .eq('user_id', userId);
      if (error) throw error;
      return data.map((row) => row.vendor_id);
    },
    enabled: userId.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const vendorIds = query.data ?? [];
  return {
    vendorIds,
    isVendor: vendorIds.length > 0,
    /** Still checking (signed in, not answered yet). */
    isPending: userId.length > 0 && query.isPending,
  };
}

// Conversations ----------------------------------------------------------------------------

type ConversationRow = {
  id: string;
  side: string;
  vendor_id: string;
  vendor_slug: string;
  vendor_name: string;
  vendor_name_pa: string | null;
  vendor_cover_path: string | null;
  family_name: string | null;
  last_message_at: string;
  last_kind: string | null;
  last_body: string | null;
  last_sender_role: string | null;
  unread_count: number;
  other_read_at: string | null;
};

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    side: row.side === 'vendor' ? 'vendor' : 'family',
    vendor: {
      id: row.vendor_id,
      slug: row.vendor_slug,
      name: row.vendor_name_pa
        ? { en: row.vendor_name, pa: row.vendor_name_pa }
        : { en: row.vendor_name },
      photoUrl: row.vendor_cover_path ? photoUrl(row.vendor_cover_path, 'small') : null,
    },
    family: { firstName: row.family_name },
    lastMessage: row.last_kind
      ? {
          kind: row.last_kind as MessageKind,
          body: row.last_body,
          senderRole: row.last_sender_role ?? 'family',
        }
      : null,
    unreadCount: row.unread_count,
    updatedAt: row.last_message_at,
    otherReadAt: row.other_read_at,
  };
}

/** Re-fetch the inbox whenever any of my conversations changes (Realtime). */
function useLiveInbox(userId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      // Unique per subscriber: the inbox and an open chat may both listen
      .channel(`inbox:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void queryClient.invalidateQueries({ queryKey: chatKeys.conversations(userId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/** My conversations, newest first: as a family, and as a vendor if I run one. */
export function useConversations() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  useLiveInbox(userId);
  return useQuery({
    queryKey: chatKeys.conversations(userId),
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase.rpc('my_conversations');
      if (error) throw error;
      return (data as ConversationRow[]).map(toConversation);
    },
    enabled: userId.length > 0,
  });
}

/** Unread messages across my conversations, for a badge. */
export function useUnreadCount(): number {
  const conversations = useConversations();
  return (conversations.data ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
}

/**
 * Open (or create) my conversation with a vendor, for "Message" on a profile.
 * Call it inside requireSignIn(); returns the conversation id.
 */
export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vendorId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('start_conversation', { p_vendor_id: vendorId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
  });
}

// Messages --------------------------------------------------------------------------------------

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_role: string;
  kind: string;
  body: string | null;
  data: Record<string, unknown>;
  reply_to?: string | null;
  created_at: string;
};

export function toMessage(
  row: MessageRow,
  mySide: ChatSide | null,
  otherReadAt: string | null,
): Message {
  const d = row.data ?? {};
  const role = (row.sender_role as Message['senderRole']) ?? 'system';
  const mine = mySide !== null && role === mySide;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_user_id,
    senderRole: role,
    kind: row.kind as MessageKind,
    body: row.body,
    photoPath: row.kind === 'photo' && typeof d.path === 'string' ? d.path : null,
    quote:
      row.kind === 'quote' && typeof d.amount === 'number'
        ? {
            amount: d.amount,
            unit: typeof d.unit === 'string' ? d.unit : undefined,
            eventSlug: typeof d.eventSlug === 'string' ? d.eventSlug : undefined,
            date: typeof d.date === 'string' ? d.date : undefined,
            guests: typeof d.guests === 'string' ? d.guests : undefined,
            note: typeof d.note === 'string' ? d.note : undefined,
            validUntil: typeof d.validUntil === 'string' ? d.validUntil : undefined,
          }
        : null,
    menuId: row.kind === 'menu' && typeof d.menuId === 'string' ? d.menuId : null,
    booking:
      row.kind === 'booking'
        ? {
            eventSlugs: Array.isArray(d.eventSlugs) ? (d.eventSlugs as string[]) : [],
            eventDate: typeof d.eventDate === 'string' ? d.eventDate : null,
            startTime: typeof d.startTime === 'string' ? d.startTime : null,
            guestBand: typeof d.guestBand === 'string' ? d.guestBand : null,
            location: typeof d.location === 'string' ? d.location : null,
            details:
              d.details && typeof d.details === 'object'
                ? (d.details as Record<string, unknown>)
                : {},
          }
        : null,
    phone: row.kind === 'phone' && typeof d.phone === 'string' ? d.phone : null,
    voice:
      row.kind === 'voice' && typeof d.path === 'string' && typeof d.durationMs === 'number'
        ? { path: d.path, durationMs: d.durationMs }
        : null,
    deposit:
      row.kind === 'deposit' && typeof d.depositId === 'string'
        ? {
            depositId: d.depositId,
            update: d.update === 'paid' || d.update === 'refunded' ? d.update : null,
          }
        : null,
    replyTo: row.reply_to ?? null,
    createdAt: row.created_at,
    readAt: mine && otherReadAt && otherReadAt >= row.created_at ? otherReadAt : null,
    reactions: [],
  };
}

async function fetchReactions(conversationId: string): Promise<ReactionRow[]> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, reaction')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return data;
}

async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, conversation_id, sender_user_id, sender_role, kind, body, data, reply_to, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at')
    .limit(500);
  if (error) throw error;
  return data as MessageRow[];
}

/**
 * One conversation's messages, oldest first, live: new messages from the
 * other side appear as they're sent. Marks the conversation read when opened
 * and whenever a message arrives while it's open.
 */
export function useConversation(conversationId: string) {
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const convo = conversations.data?.find((c) => c.id === conversationId) ?? null;
  const key = chatKeys.messages(conversationId);

  const { session } = useSession();
  const me = session?.user.id ?? null;

  const messages = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(conversationId),
    enabled: conversationId.length > 0,
  });
  const reactions = useQuery({
    queryKey: chatKeys.reactions(conversationId),
    queryFn: () => fetchReactions(conversationId),
    enabled: conversationId.length > 0,
  });

  useEffect(() => {
    if (!conversationId) return;
    const messagesKey = chatKeys.messages(conversationId);
    const markRead = () =>
      void supabase
        .rpc('mark_conversation_read', { p_conversation_id: conversationId })
        .then(() => queryClient.invalidateQueries({ queryKey: chatKeys.all }));
    markRead();
    const channel = supabase
      .channel(`conversation:${conversationId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<MessageRow[]>(messagesKey, (list) => {
            const row = payload.new as MessageRow;
            if (!list) return [row];
            return list.some((m) => m.id === row.id) ? list : [...list, row];
          });
          markRead();
        },
      )
      // Reactions from either side, as they're added, changed or taken back
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: chatKeys.reactions(conversationId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const byMessage = summarizeReactions(reactions.data ?? [], me);
  return {
    ...messages,
    conversation: convo,
    messages: (messages.data ?? []).map((row) => ({
      ...toMessage(row, convo?.side ?? null, convo?.otherReadAt ?? null),
      reactions: byMessage.get(row.id) ?? [],
    })),
  };
}

/**
 * React to a message (or take your reaction back with null). Shows at once on
 * this phone, and is undone if it doesn't save.
 */
export function useReactToMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = chatKeys.reactions(conversationId);
  return useMutation({
    mutationFn: async ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: ReactionCode | null;
    }) => {
      const { error } = await supabase.rpc('react_to_message', {
        p_message_id: messageId,
        // The API's types can't say "null"; null takes the reaction back
        p_reaction: reaction as string,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ messageId, reaction }) => {
      const me = session?.user.id;
      if (!me) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionRow[]>(key);
      queryClient.setQueryData<ReactionRow[]>(key, (rows) =>
        applyReaction(rows ?? [], messageId, me, reaction),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export type NewMessage =
  | { kind: 'text'; body: string }
  | { kind: 'photo'; path: string; width?: number; height?: number; body?: string }
  | { kind: 'quote'; quote: Quote; body?: string }
  | { kind: 'menu'; menuId: string; body?: string }
  /** The family shares the number on their profile (the database fills it in). */
  | { kind: 'phone' }
  /** A recording uploaded with uploadChatVoice(), up to 5 minutes. */
  | { kind: 'voice'; path: string; durationMs: number };

export function messagePayload(message: NewMessage): {
  kind: MessageKind;
  body: string | null;
  data: Record<string, unknown>;
} {
  switch (message.kind) {
    case 'text':
      return { kind: 'text', body: message.body, data: {} };
    case 'photo':
      return {
        kind: 'photo',
        body: message.body ?? null,
        data: { path: message.path, width: message.width, height: message.height },
      };
    case 'quote':
      return { kind: 'quote', body: message.body ?? null, data: { ...message.quote } };
    case 'menu':
      return { kind: 'menu', body: message.body ?? null, data: { menuId: message.menuId } };
    case 'phone':
      return { kind: 'phone', body: null, data: {} };
    case 'voice':
      return {
        kind: 'voice',
        body: null,
        data: { path: message.path, durationMs: Math.round(message.durationMs) },
      };
  }
}

/** A message to send, optionally as a reply to an earlier one (swipe to reply). */
export type Outgoing = NewMessage & { replyTo?: string | null };

/** Send a message; it shows at once and is confirmed (or removed on failure). */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = chatKeys.messages(conversationId);
  return useMutation({
    mutationFn: async (message: Outgoing) => {
      const { kind, body, data } = messagePayload(message);
      const { data: id, error } = await supabase.rpc('send_message', {
        p_conversation_id: conversationId,
        p_kind: kind,
        p_body: body ?? undefined,
        // Only JSON values go in (numbers, strings, undefined dropped)
        p_data: JSON.parse(JSON.stringify(data)) as Json,
        p_reply_to: message.replyTo ?? undefined,
      });
      if (error) throw new Error(error.message);
      return id;
    },
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageRow[]>(key);
      const { kind, body, data } = messagePayload(message);
      const conversations = queryClient.getQueryData<Conversation[]>(
        chatKeys.conversations(session?.user.id ?? ''),
      );
      const side = conversations?.find((c) => c.id === conversationId)?.side ?? 'family';
      const temp: MessageRow = {
        id: `pending-${Date.now()}`,
        conversation_id: conversationId,
        sender_user_id: session?.user.id ?? null,
        sender_role: side,
        kind,
        body,
        data,
        reply_to: message.replyTo ?? null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<MessageRow[]>(key, (list) => [...(list ?? []), temp]);
      return { previous };
    },
    onError: (_e, _m, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

/** Which message to show when sending fails (the database's error names). */
export function sendErrorKind(
  error: unknown,
): 'rate' | 'empty' | 'notAllowed' | 'familyFirst' | 'waitForReply' | 'invalid' | 'failed' {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('message_rate')) return 'rate';
  // The no-spam rules (C2): vendors only reply, and follow up at most twice
  if (message.includes('family_first')) return 'familyFirst';
  if (message.includes('wait_for_reply')) return 'waitForReply';
  if (message.includes('empty_message')) return 'empty';
  if (message.includes('not_allowed')) return 'notAllowed';
  if (message.includes('invalid_')) return 'invalid';
  return 'failed';
}

// Photos ------------------------------------------------------------------------------------------

/**
 * Upload a chat photo (bytes from the image picker) into the conversation's
 * folder; send it with useSendMessage({ kind: 'photo', path }).
 */
export async function uploadChatPhoto(
  conversationId: string,
  bytes: ArrayBuffer,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' = 'image/jpeg',
): Promise<string> {
  const extension = contentType.split('/')[1].replace('jpeg', 'jpg');
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export type VoiceContentType =
  'audio/mp4' | 'audio/m4a' | 'audio/x-m4a' | 'audio/aac' | 'audio/mpeg' | 'audio/webm';

const VOICE_EXTENSIONS: Record<VoiceContentType, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
};

/** The longest voice note the database takes: 5 minutes. */
export const MAX_VOICE_MS = 5 * 60 * 1000;

/**
 * Upload a voice note (bytes of the recording) into the conversation's folder;
 * send it with useSendMessage({ kind: 'voice', path, durationMs }).
 */
export async function uploadChatVoice(
  conversationId: string,
  bytes: ArrayBuffer,
  contentType: VoiceContentType = 'audio/mp4',
): Promise<string> {
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${VOICE_EXTENSIONS[contentType]}`;
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** A short-lived link to show a chat photo (the bucket is private). */
export function useChatPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: [...chatKeys.all, 'photo', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(path ?? '', 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });
}
