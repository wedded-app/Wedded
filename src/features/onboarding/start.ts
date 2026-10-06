import { router } from 'expo-router';
import { useCallback } from 'react';

import { useSession } from '@/features/auth/session';

import { resetAnswers } from './answers';

/**
 * "Start planning" on Home and My Wedding. A plan belongs to an account, so
 * someone signed out signs in first, then gets the first questions.
 */
export function useStartPlanning() {
  const { requireSignIn } = useSession();
  return useCallback(
    () =>
      requireSignIn(() => {
        resetAnswers();
        router.push('/onboarding/who');
      }),
    [requireSignIn],
  );
}
