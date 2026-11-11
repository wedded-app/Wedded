import { router } from 'expo-router';
import { useCallback } from 'react';

import { prefetchFirstQuestions } from '@/data/reference';

import { resetAnswers } from './answers';
import { FIRST_STEP } from './steps';

/**
 * "Start your plan" on Home and My Wedding: the first questions, whose
 * answers start loading on the tap. No account needed: signed out, the plan
 * they make stays on this phone until they save it (2026-11-11).
 */
export function useStartPlanning() {
  return useCallback(() => {
    prefetchFirstQuestions();
    resetAnswers();
    router.push(FIRST_STEP);
  }, []);
}
