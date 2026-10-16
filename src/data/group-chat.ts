/**
 * Group chat (A3, #126; the group chat migration): family and friends
 * planning a wedding in one thread, with Wed answering when tagged @Wed.
 * Only a thread's members read it; owners and editors of the wedding who are
 * in it manage it (rename, add, remove, links). Messages arrive live through
 * Supabase Realtime. The screen is A2 (#125); Wed's brain is A1 (#124).
 *
 * Photos use the chat's helpers with the thread's id as the folder:
 * uploadChatPhoto(threadId, bytes) then useSendGroupMessage's `photo`, and
 * useChatPhotoUrl(message.data.path) to show one (src/data/chat.ts).
 * Push alerts and emails are sent by the server (push-chat, notify-chat).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type GroupThread = {
  id: string;
  weddingId: string;
  name: string;
  memberCount: number;
  canManage: boolean;
  lastMessageAt: string;
  lastKind: GroupMessageKind | null;
  lastBody: string | null;
  lastSenderRole: GroupSenderRole | null;
  lastSenderName: string | null;
  /** The last message is mine: the list says "You: …". */
  lastSenderIsMe: boolean;
  unreadCount: number;
};

export type GroupSenderRole = 'member' | 'wed' | 'system';
export type GroupMessageKind = 'text' | 'photo' | 'joined' | 'left';
export type WedAsk = 'waiting' | 'working' | 'answered' | 'failed';

/**
 * A row of group_messages. `data` is {path, width, height} on a photo (body is
 * its caption, if any) and {vendorIds} on Wed's answers (its vendor cards).
 */
export type GroupMessage = Omit<
  Database['public']['Tables']['group_messages']['Row'],
  'sender_role' | 'kind' | 'wed_ask'
> & { sender_role: GroupSenderRole; kind: GroupMessageKind; wed_ask: WedAsk | null };

export type GroupMember = {
  userId: string;
  name: string | null;
  /** Their role in the wedding; null for a friend outside it. */
  weddingRole: string | null;
  canManage: boolean;
  isMe: boolean;
  joinedAt: string;
};

export type GroupInviteStatus = 'valid' | 'expired' | 'used_up' | 'revoked' | 'not_found';

export const groupKeys = {
  all: ['group-chat'] as const,
  threads: (userId: string) => [...groupKeys.all, 'threads', userId] as const,
  messages: (threadId: string) => [...groupKeys.all, 'messages', threadId] as const,
  members: (threadId: string) => [...groupKeys.all, 'members', threadId] as const,
  invite: (token: string) => [...groupKeys.all, 'invite', token] as const,
};

/** My threads, newest first, refreshed live when a message lands in any of them. */
export function useGroupThreads() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      // Unique per subscriber: the list and an open thread may both listen
      .channel(`group-inbox:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => {
          void queryClient.invalidateQueries({ queryKey: groupKeys.threads(userId) });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
  return useQuery({
    queryKey: groupKeys.threads(userId),
    queryFn: async (): Promise<GroupThread[]> => {
      const { data, error } = await supabase.rpc('my_group_threads');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        weddingId: row.wedding_id,
        name: row.name,
        memberCount: row.member_count,
        canManage: row.can_manage,
        lastMessageAt: row.last_message_at,
        lastKind: row.last_kind as GroupMessageKind | null,
        lastBody: row.last_body,
        lastSenderRole: row.last_sender_role as GroupSenderRole | null,
        lastSenderName: row.last_sender_name,
        lastSenderIsMe: row.last_sender_is_me,
        unreadCount: row.unread_count,
      }));
    },
    enabled: userId.length > 0,
  });
}

/**
 * A thread's latest 200 messages, oldest first, live. Marks it read when
 * opened and whenever a message arrives while it's open.
 */
export function useGroupMessages(threadId: string) {
  const queryClient = useQueryClient();
  const key = groupKeys.messages(threadId);
  useEffect(() => {
    if (!threadId) return;
    const markRead = () =>
      void supabase
        .rpc('mark_group_read', { p_thread_id: threadId })
        .then(() => queryClient.invalidateQueries({ queryKey: [...groupKeys.all, 'threads'] }));
    markRead();
    const channel = supabase
      .channel(`group:${threadId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        // Inserts, and an ask moving from waiting to answered
        () => {
          void queryClient.invalidateQueries({ queryKey: groupKeys.messages(threadId) });
          markRead();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<GroupMessage[]> => {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as GroupMessage[]).reverse();
    },
    enabled: threadId.length > 0,
  });
}

export type GroupPhoto = { path: string; width?: number; height?: number };

/** Send a text, or a photo already uploaded with uploadChatPhoto(threadId, …) and an optional caption. Tagging @Wed asks Wed. */
export function useSendGroupMessage(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      replyTo,
      photo,
    }: {
      body?: string;
      replyTo?: string;
      photo?: GroupPhoto;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('send_group_message', {
        p_thread_id: threadId,
        p_body: body,
        p_reply_to: replyTo,
        p_photo: photo,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.messages(threadId) }),
  });
}

/** Start a thread in a wedding (owners and editors), with some of its members. Returns its id. */
export function useCreateGroupThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weddingId,
      name,
      memberIds = [],
    }: {
      weddingId: string;
      name: string;
      memberIds?: string[];
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('create_group_thread', {
        p_wedding_id: weddingId,
        p_name: name,
        p_member_ids: memberIds,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

/** Who is in a thread, in the order they joined. */
export function useGroupMembers(threadId: string) {
  return useQuery({
    queryKey: groupKeys.members(threadId),
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase.rpc('group_members_list', { p_thread_id: threadId });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        name: row.name,
        weddingRole: row.wedding_role,
        canManage: row.can_manage,
        isMe: row.is_me,
        joinedAt: row.joined_at,
      }));
    },
    enabled: threadId.length > 0,
  });
}

/** Managers: add members of the wedding to a thread. */
export function useAddGroupMembers(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { error } = await supabase.rpc('add_group_members', {
        p_thread_id: threadId,
        p_user_ids: userIds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

/** Leave (your own id) or, as a manager, remove someone. */
export function useRemoveGroupMember(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_group_member', {
        p_thread_id: threadId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

/** Managers: rename a thread. */
export function useRenameGroupThread(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('rename_group_thread', {
        p_thread_id: threadId,
        p_name: name,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

/** The join page for a thread's link; the screen (#125) adds the route. */
export function groupInviteLink(token: string): string {
  return SITE_URL_IS_PLACEHOLDER
    ? Linking.createURL(`/join-chat/${token}`)
    : siteLink(`/join-chat/${token}`);
}

/** Managers: make a join link (14 days, 20 uses). Returns the link to share. */
export function useCreateGroupInvite() {
  return useMutation({
    mutationFn: async (threadId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_group_invite', { p_thread_id: threadId });
      if (error) throw new Error(error.message);
      return groupInviteLink(data);
    },
  });
}

/** What someone sees before joining. Works logged out. */
export function useGroupInvitePreview(token: string) {
  return useQuery({
    queryKey: groupKeys.invite(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('group_invite_preview', { p_token: token });
      if (error) throw error;
      const row = data[0];
      return {
        status: (row?.status ?? 'not_found') as GroupInviteStatus,
        threadName: row?.thread_name ?? null,
        weddingTitle: row?.wedding_title ?? null,
        inviterName: row?.inviter_name ?? null,
        memberCount: row?.member_count ?? 0,
      };
    },
    enabled: token.length > 0,
  });
}

/** Join a thread with a link token. Call it inside requireSignIn(); returns the thread id. */
export function useAcceptGroupInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc('accept_group_invite', { p_token: token });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export type GroupError =
  | 'not_allowed'
  | 'empty'
  | 'rate'
  | 'revoked'
  | 'expired'
  | 'used_up'
  | 'not_found'
  | 'full'
  | 'too_many'
  | 'thread_limit'
  | 'failed';

/** Which plain-words message (groupChat.errors.*) a group chat error gets. */
export function groupErrorKind(error: unknown): GroupError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('not_allowed')) return 'not_allowed';
  if (message.includes('empty_message') || message.includes('invalid_name')) return 'empty';
  if (message.includes('message_rate')) return 'rate';
  if (message.includes('invite_revoked')) return 'revoked';
  if (message.includes('invite_expired')) return 'expired';
  if (message.includes('invite_used_up')) return 'used_up';
  if (message.includes('invite_not_found')) return 'not_found';
  if (message.includes('group_full')) return 'full';
  if (message.includes('too_many_groups')) return 'too_many';
  if (message.includes('thread_limit')) return 'thread_limit';
  return 'failed';
}
