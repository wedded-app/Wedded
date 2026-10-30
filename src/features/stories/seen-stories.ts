import { useSyncExternalStore } from 'react';

import type { StoryGroup } from '@/data/stories';
import { readSetting, StorageKeys, writeSetting } from '@/lib/storage';
import { createListeners } from '@/lib/listeners';

// Stories watched on this phone, so their rings turn grey, as on Instagram.
// Each is remembered for two days; a story only lasts one.
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;
const { subscribe, notify } = createListeners();
let seen: Map<string, number> | null = null;
let version = 0;

function load(): Map<string, number> {
  if (seen) return seen;
  const now = Date.now();
  try {
    const saved: Record<string, number> = JSON.parse(readSetting(StorageKeys.seenStories) ?? '{}');
    seen = new Map(Object.entries(saved).filter(([, at]) => now - at < KEEP_MS));
  } catch {
    seen = new Map();
  }
  return seen;
}

export function markStorySeen(storyId: string) {
  const all = load();
  if (all.has(storyId)) return;
  all.set(storyId, Date.now());
  version += 1;
  notify();
  void writeSetting(StorageKeys.seenStories, JSON.stringify(Object.fromEntries(all)));
}

/** Whether a story has been watched; re-renders when that changes. */
export function useStorySeen(): (storyId: string) => boolean {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return (storyId) => load().has(storyId);
}

/** Every story in the group has been watched. */
export function groupSeen(group: StoryGroup, isSeen: (storyId: string) => boolean): boolean {
  return group.stories.every((story) => isSeen(story.id));
}

/**
 * The order the rings sit in and play in: your own first, then everyone
 * with something new, then the ones already watched.
 */
export function trayOrder(
  groups: StoryGroup[],
  isSeen: (storyId: string) => boolean,
): StoryGroup[] {
  const mine = groups.filter((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  return [
    ...mine,
    ...others.filter((g) => !groupSeen(g, isSeen)),
    ...others.filter((g) => groupSeen(g, isSeen)),
  ];
}
