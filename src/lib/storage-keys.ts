export const StorageKeys = {
  /** Where to search from and how far, as JSON (src/features/location). */
  searchLocation: 'settings.searchLocation',
  /** Settings > Appearance: system, light or dark. */
  appearance: 'settings.appearance',
  /** Settings > Text size: default, large or xlarge. */
  textSize: 'settings.textSize',
  /** Settings > Haptics: "off" turns them off. */
  haptics: 'settings.haptics',
  /** My Wedding planner, as JSON (src/features/planner). */
  weddingPlan: 'planner.wedding',
  /** The date and guests told before signing in, as JSON (features/home/wedding-draft). */
  weddingDraft: 'planner.draft',
  /** The welcome screen and first questions: "seen" (they chose to browse) or "done". */
  onboarding: 'settings.onboarding',
  /** Which side of the app this phone last chose: "business" or "planning" (features/business/app-mode). */
  appMode: 'settings.mode',
  /** Reels' first-time "Swipe up for more": "done" once they've swiped. */
  reelsSwipeHint: 'reels.swipeHint',
  /** Stories watched on this phone, as JSON of story id to when (features/stories/seen-stories). */
  seenStories: 'stories.seen',
  /** This phone's Expo push token once registered (src/data/push.ts), to forget it on sign out. */
  pushToken: 'push.token',
} as const;
