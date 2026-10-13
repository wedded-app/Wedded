/**
 * "Harjit K. is typing…" in a conversation, over a Supabase Realtime
 * broadcast channel per conversation (`typing:<id>`). Nothing is stored: a
 * side says it's typing at most every 2 seconds while keys are pressed, and
 * that it stopped 5 seconds after the last one, on send, or on leaving the
 * box. The other side hides the dots 6 seconds after the last word, in case
 * "stopped" never arrives. The only thing sent is which side is typing.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatSide } from '@/data/chat';
import { supabase } from '@/lib/supabase';

export const TYPING_PING_MS = 2000;
export const TYPING_IDLE_MS = 5000;
export const TYPING_SHOW_MS = 6000;

type TypingPayload = { side: ChatSide; typing: boolean };

function isTypingPayload(value: unknown): value is TypingPayload {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (p.side === 'family' || p.side === 'vendor') && typeof p.typing === 'boolean';
}

/**
 * Says "typing" at most once per TYPING_PING_MS while keys are pressed, and
 * "stopped" TYPING_IDLE_MS after the last one or when told to stop.
 */
export function createTypingSender(send: (typing: boolean) => void) {
  let lastSent = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (idle) clearTimeout(idle);
    idle = undefined;
    if (lastSent) {
      lastSent = 0;
      send(false);
    }
  };
  const typed = () => {
    const now = Date.now();
    if (!lastSent || now - lastSent >= TYPING_PING_MS) {
      lastSent = now;
      send(true);
    }
    if (idle) clearTimeout(idle);
    idle = setTimeout(stop, TYPING_IDLE_MS);
  };
  return { typed, stop };
}

// One channel per conversation, shared by whoever listens on this phone. A
// channel's topic is its name, so leaving and coming straight back reuses it
// rather than racing the old one as it closes.
type Shared = {
  channel: RealtimeChannel;
  listeners: Set<(payload: TypingPayload) => void>;
  users: number;
  closing?: ReturnType<typeof setTimeout>;
};
const shared = new Map<string, Shared>();

function joinTyping(conversationId: string): Shared | null {
  const existing = shared.get(conversationId);
  if (existing) {
    if (existing.closing) clearTimeout(existing.closing);
    existing.closing = undefined;
    existing.users += 1;
    return existing;
  }
  try {
    const listeners = new Set<(payload: TypingPayload) => void>();
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (isTypingPayload(payload)) for (const listener of listeners) listener(payload);
      })
      .subscribe();
    const entry: Shared = { channel, listeners, users: 1 };
    shared.set(conversationId, entry);
    return entry;
  } catch {
    // Typing dots are a nicety: the chat works without them
    return null;
  }
}

function leaveTyping(conversationId: string, entry: Shared) {
  entry.users -= 1;
  if (entry.users > 0) return;
  entry.closing = setTimeout(() => {
    shared.delete(conversationId);
    void supabase.removeChannel(entry.channel);
  }, 1500);
}

/**
 * Whether the other side is typing in this conversation, and `typed` /
 * `stopped` to tell them about this side. Pass the side once it's known.
 */
export function useTyping(conversationId: string, side: ChatSide | null) {
  const [otherTyping, setOtherTyping] = useState(false);
  const sender = useRef<ReturnType<typeof createTypingSender> | null>(null);

  useEffect(() => {
    if (!conversationId || !side) return;
    const entry = joinTyping(conversationId);
    if (!entry) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const listener = (payload: TypingPayload) => {
      if (payload.side === side) return;
      if (hide) clearTimeout(hide);
      setOtherTyping(payload.typing);
      if (payload.typing) hide = setTimeout(() => setOtherTyping(false), TYPING_SHOW_MS);
    };
    entry.listeners.add(listener);
    const mine = createTypingSender((typing) => {
      void entry.channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { side, typing } satisfies TypingPayload,
      });
    });
    sender.current = mine;
    return () => {
      mine.stop();
      sender.current = null;
      if (hide) clearTimeout(hide);
      entry.listeners.delete(listener);
      setOtherTyping(false);
      leaveTyping(conversationId, entry);
    };
  }, [conversationId, side]);

  const typed = useCallback(() => sender.current?.typed(), []);
  const stopped = useCallback(() => sender.current?.stop(), []);
  return { otherTyping, typed, stopped };
}
