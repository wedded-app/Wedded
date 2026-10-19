/**
 * Inquiries (vision S11, S12): sending goes through the send-inquiry Edge
 * Function, which applies the rules (profile, limits, duplicates) and emails
 * the vendor. The app can read its own inquiries; the only thing it writes is
 * the family's answer to the follow-up "Did they get back to you?".
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

import { savedKeys } from './saved';

export type GuestBand = 'under_50' | '50_100' | '100_250' | '250_500' | '500_plus' | 'not_sure';
export type ReplyBy = 'call' | 'text' | 'whatsapp' | 'email';
/** "Did they get back to you?": Yes, booked / Yes, still deciding / No reply yet. */
export type ReplyAnswer = 'booked' | 'deciding' | 'no_reply';
export const REPLY_ANSWERS: ReplyAnswer[] = ['booked', 'deciding', 'no_reply'];

export type InquiryDraft = {
  vendorId: string;
  /** Empty means "Not sure". */
  eventSlugs: string[];
  /** YYYY-MM-DD; null for "Not sure yet". Never a Date, so it can't shift a day. */
  eventDate: string | null;
  /** HH:MM, 24-hour; optional. */
  startTime?: string | null;
  guestBand: GuestBand;
  /** City or venue. */
  location: string;
  message: string;
  preferredContact: ReplyBy;
  /** Answers to the category's own questions. */
  details?: Record<string, unknown>;
  /** Defaults to the profile; the form lets people edit them. */
  name?: string;
  phone?: string;
  /** After "You already asked on …", they chose to send again. */
  sendAgain?: boolean;
};

export type SendOutcome =
  | { kind: 'sent'; id: string }
  /** The app's daily email limit is reached; it goes first thing tomorrow. */
  | { kind: 'queued'; id: string }
  | { kind: 'duplicate'; previousAt: string }
  | { kind: 'rateLimited'; limit: 'hour' | 'day' }
  | { kind: 'needsProfile' }
  | { kind: 'vendorNotFound' }
  | { kind: 'invalid'; field: string }
  /** Saved but the email failed: keep the form and offer to try again. */
  | { kind: 'failed' }
  | { kind: 'offline' };

type ErrorBody = { error?: string; field?: string; previousAt?: string; limit?: 'hour' | 'day' };

/** Sends an inquiry and says what happened, in terms the form can show. */
export async function sendInquiry(draft: InquiryDraft): Promise<SendOutcome> {
  const { data, error } = await supabase.functions.invoke<{ id: string; status: string }>(
    'send-inquiry',
    { body: draft },
  );

  if (!error && data) {
    return data.status === 'queued'
      ? { kind: 'queued', id: data.id }
      : { kind: 'sent', id: data.id };
  }
  if (error instanceof FunctionsFetchError) return { kind: 'offline' };
  if (!(error instanceof FunctionsHttpError)) return { kind: 'failed' };

  const response = error.context as Response;
  const body: ErrorBody = await response.json().catch(() => ({}));
  switch (response.status) {
    case 409:
      return { kind: 'duplicate', previousAt: body.previousAt ?? '' };
    case 429:
      return { kind: 'rateLimited', limit: body.limit ?? 'hour' };
    case 403:
      return { kind: 'needsProfile' };
    case 404:
      return { kind: 'vendorNotFound' };
    case 400:
      return { kind: 'invalid', field: body.field ?? '' };
    default:
      return { kind: 'failed' };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether My inquiries should ask "Did they get back to you?": sending
 * schedules the question two days on (followups.asked_at), until answered.
 */
export function followUpDue(
  followUp: { asked_at: string; answer: string | null } | undefined,
  now: number,
): boolean {
  return (
    followUp !== undefined &&
    followUp.answer === null &&
    new Date(followUp.asked_at).getTime() <= now
  );
}

export const inquiryKeys = {
  all: ['inquiries'] as const,
  mine: (userId: string) => [...inquiryKeys.all, userId] as const,
};

/** Send an inquiry. Refreshes Saved too: asking a vendor saves them under the event. */
export function useSendInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendInquiry,
    onSuccess: (outcome) => {
      if (outcome.kind === 'sent' || outcome.kind === 'queued') {
        void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
        // The inquiry also started a chat with the vendor
        void queryClient.invalidateQueries({ queryKey: ['chat'] });
        void queryClient.invalidateQueries({ queryKey: savedKeys.all });
      }
    },
  });
}

async function fetchMyInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select(
      'id, vendor_id, event_date, guest_band, status, created_at, sent_at, vendor:vendors!inquiries_vendor_id_fkey(slug, name), inquiry_events(event_slug, position), followups(question, asked_at, answer)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return data.map(({ inquiry_events, followups, ...inquiry }) => {
    const followUp = followups.find((f) => f.question === 'did_they_reply');
    return {
      ...inquiry,
      /** The events in the order the family picked them. */
      event_slugs: [...inquiry_events]
        .sort((a, b) => a.position - b.position)
        .map((e) => e.event_slug),
      /** "Ask again" shows once 24 hours have passed, or if it didn't send (S16c). */
      canAskAgain:
        inquiry.status === 'failed' || now - new Date(inquiry.created_at).getTime() > DAY_MS,
      /** Their answer to "Did they get back to you?", once they've given one. */
      followUpAnswer: (followUp?.answer ?? null) as ReplyAnswer | null,
      followUpDue: followUpDue(followUp, now),
    };
  });
}

/** The signed-in person's inquiries, newest first ("My inquiries", S16c). */
export function useMyInquiries() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: inquiryKeys.mine(userId),
    queryFn: fetchMyInquiries,
    enabled: userId.length > 0,
  });
}

/** Save the family's answer to "Did they get back to you?" on one of their inquiries. */
export function useAnswerFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inquiryId, answer }: { inquiryId: string; answer: ReplyAnswer }) => {
      const { error } = await supabase
        .from('followups')
        .update({ answer })
        .eq('inquiry_id', inquiryId)
        .eq('question', 'did_they_reply');
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
      // "Yes, we booked them" also books the vendor in a shared plan
      void queryClient.invalidateQueries({ queryKey: ['weddings'] });
    },
  });
}
