import { router } from 'expo-router';
import { useCallback } from 'react';

import { prefetchFirstQuestions } from '@/data/reference';
import { useSession } from '@/features/auth/session';

import { resetAnswers } from './answers';
import { FIRST_STEP } from './steps';

/**
 * "Start planning" on Home and My Wedding. A plan belongs to an account, so
 * someone signed out signs in first, then gets the first questions, whose
 * answers start loading on the tap.
 */
export function useStartPlanning() {
  const { requireSignIn } = useSession();
  return useCallback(() => {
    prefetchFirstQuestions();
    requireSignIn(
      () => {
        resetAnswers();
        router.push(FIRST_STEP);
      },
      { planning: true },
    );
  }, [requireSignIn]);
}
