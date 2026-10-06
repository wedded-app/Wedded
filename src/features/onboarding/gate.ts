import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useIsVendor } from '@/data/chat';
import { useMyWeddings } from '@/data/wedding';
import { useSession } from '@/features/auth/session';

import { markOnboarding, useOnboardingState } from './onboarding-state';

export type OnboardingGate = 'wait' | '/welcome' | '/onboarding/who' | null;

/**
 * Where the tabs should send someone who hasn't been through the welcome
 * screen yet: signed out, to /welcome; signed in as a family with no plan,
 * to the first questions. Vendors, and anyone whose account already has a
 * wedding, go straight in and are counted as done.
 * Only opening Home can send them anywhere: a shared link to a results or
 * event page (/c/dj, /e/jaago) opens that page, and /v and /join links are
 * outside the tabs altogether.
 */
export function useOnboardingGate(): OnboardingGate {
  const state = useOnboardingState();
  const atHome = usePathname() === '/';
  const { status } = useSession();
  const weddings = useMyWeddings();
  const vendor = useIsVendor();

  const signedIn = status === 'signedIn';
  const checking = signedIn && (weddings.isPending || vendor.isPending);
  const hasPlan = (weddings.data?.length ?? 0) > 0;
  const skip = state === 'new' && signedIn && !checking && (vendor.isVendor || hasPlan);

  useEffect(() => {
    if (skip) markOnboarding('done');
  }, [skip]);

  if (state !== 'new' || skip || !atHome) return null;
  if (status === 'loading' || checking) return 'wait';
  if (status === 'signedOut') return '/welcome';
  // needsProfile and error: the sign-in sheet finishes About you first.
  if (!signedIn) return null;
  return '/onboarding/who';
}
