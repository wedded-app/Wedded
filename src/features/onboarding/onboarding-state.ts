/**
 * Whether this phone has been through the welcome screen: unset the first
 * time the app opens (Home sends them to /welcome), "seen" once they chose to
 * browse first, "done" once they answered the first questions.
 */
import { useSyncExternalStore } from 'react';

import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';
import { createListeners } from '@/lib/listeners';

export type OnboardingState = 'new' | 'seen' | 'done';

function load(): OnboardingState {
  const value = readSetting(StorageKeys.onboarding);
  return value === 'seen' || value === 'done' ? value : 'new';
}

let state: OnboardingState | null = null;
const { subscribe, notify } = createListeners();

function current(): OnboardingState {
  state ??= load();
  return state;
}

/** Remember how far they got; "done" is never downgraded to "seen". */
export function markOnboarding(next: 'seen' | 'done') {
  if (current() === 'done' && next === 'seen') return;
  state = next;
  void writeSetting(StorageKeys.onboarding, next);
  notify();
}

/** Development only (Settings): forget it, so Home sends them to /welcome again. */
export function resetOnboarding() {
  state = 'new';
  void writeSetting(StorageKeys.onboarding, 'new');
  notify();
}

export function useOnboardingState(): OnboardingState {
  // While the web build pre-renders there's no storage: count them as having
  // seen it, so shared pages never pre-render the welcome screen.
  return useSyncExternalStore(subscribe, current, () => 'seen');
}
