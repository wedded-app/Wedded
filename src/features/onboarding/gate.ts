import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useIsVendor } from '@/data/chat';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';

import { markOnboarding, useOnboardingState } from './onboarding-state';

export type OnboardingGate = 'wait' | '/welcome' | '/onboarding/who' | '/discover' | null;

/**
 * Where the tabs should send someone who hasn't been through the welcome
 * screen yet: signed out, to /welcome; signed in as a family with no plan,
 * to the first questions, or to Reels if they joined "just looking" (#222). Vendors, and anyone whose account already has a
 * wedding, go straight in and are counted as done.
 * Only opening Home can send them anywhere: a shared link to a results or
 * event page (/c/dj, /e/jaago) opens that page, and /v and /join links are
 * outside the tabs altogether.
 */
export function useOnboardingGate(): OnboardingGate {
  const state = useOnboardingState();
  const pathname = usePathname();
  const atHome = pathname === '/';
  const { status, profile } = useSession();
  const weddings = useMyWeddings();
  const vendor = useIsVendor();

  const signedIn = status === 'signedIn';
  const checking = signedIn && (weddings.isPending || vendor.isPending);
  const hasPlan = (weddings.data?.length ?? 0) > 0;
  const skip = state === 'new' && signedIn && !checking && (vendor.isVendor || hasPlan);
  const looking =
    state === 'new' && signedIn && !checking && !skip && profile?.joined_as === 'looking';

  useEffect(() => {
    if (skip) markOnboarding('done');
    // Only once they're on Reels: marked any sooner (the tabs stay mounted under the
    // sign-in sheet, or re-render at Home before the redirect), they'd stay on Home
    else if (looking && pathname === '/discover') markOnboarding('seen');
  }, [skip, looking, pathname]);

  if (state !== 'new' || skip || !atHome) return null;
  if (status === 'loading' || checking) return 'wait';
  if (status === 'signedOut') return '/welcome';
  // needsProfile and error: the sign-in sheet finishes About you first.
  if (!signedIn) return null;
  return looking ? '/discover' : '/onboarding/who';
}
