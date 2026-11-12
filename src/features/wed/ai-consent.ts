import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { queryClient } from '@/data/query-client';
import { supabase } from '@/lib/supabase';

/**
 * Permission before Wed shares anything with an AI service (App Store rule
 * 5.1.2(i)): everything the family sends Wed goes through requireAiConsent,
 * which asks once on /wed-consent and keeps the answer on their account
 * (has_ai_consent, set_ai_consent). A new version of what's shared, in
 * legal_documents, asks everyone again.
 */

// shortcut: Wed is scripted and shares nothing, so nobody is asked yet. Turn this on in the PR
// that adds the AI call, once /wed-consent names the company and lists exactly what is sent.
export const WED_SHARES_WITH_AI = false;

const consentKey = (userId: string | undefined) => ['ai-consent', userId ?? 'signed-out'] as const;

// What the family was sending when they were asked: it goes once they say yes
let waiting: (() => void) | null = null;

async function userId(): Promise<string | undefined> {
  return (await supabase.auth.getSession()).data.session?.user.id;
}

const consentQuery = (id: string | undefined) => ({
  queryKey: consentKey(id),
  staleTime: Infinity,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('has_ai_consent');
    if (error) throw new Error(error.message);
    return data;
  },
});

/** Whether this person has said yes (kept, so the server is asked once). False signed out or offline. */
export async function hasAiConsent(): Promise<boolean> {
  try {
    return await queryClient.fetchQuery(consentQuery(await userId()));
  } catch {
    return false;
  }
}

/** The same answer for a screen: the switch in Wed's settings. */
export function useAiConsent(id: string | undefined) {
  return useQuery({ ...consentQuery(id), enabled: !!id });
}

/** Runs `action` if they've said yes; otherwise asks first, and runs it after a yes. */
export async function requireAiConsent(action: () => void, shares = WED_SHARES_WITH_AI) {
  if (!shares || (await hasAiConsent())) {
    action();
    return;
  }
  waiting = action;
  router.push('/wed-consent');
}

/** Saves the answer (signed in only). A yes sends what was waiting; a no drops it. */
export async function answerAiConsent(allowed: boolean) {
  const { error } = await supabase.rpc('set_ai_consent', { p_allowed: allowed });
  if (error) throw new Error(error.message);
  queryClient.setQueryData(consentKey(await userId()), allowed);
  const action = waiting;
  waiting = null;
  if (allowed) action?.();
}
