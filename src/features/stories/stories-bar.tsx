import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { type StoryGroup, useStories } from '@/data/stories';
import { initials } from '@/features/planner/plan-together';

import { groupSeen, trayOrder, useStorySeen } from './seen-stories';

/** The poster's newest still: a photo, or a clip's still. */
export const latestThumb = (group: StoryGroup) =>
  [...group.stories].reverse().find((story) => story.thumbUrl)?.thumbUrl ?? null;

/** Everyone's stories in ring order, with which are watched. */
export function useStoryTray() {
  const stories = useStories();
  const isSeen = useStorySeen();
  const groups = trayOrder(stories.data ?? [], isSeen);
  const seen = (group: StoryGroup) => groupSeen(group, isSeen);
  return {
    query: stories,
    groups,
    seen,
    fresh: groups.filter((g) => !g.isMine && !seen(g)).length,
  };
}

/**
 * A poster's face for a ring: their newest still (`photo`), else their
 * initials or a shop for a business.
 */
export function StoryFace({
  group,
  size,
  photo = false,
}: {
  group: StoryGroup;
  size: number;
  photo?: boolean;
}) {
  const thumb = photo ? latestThumb(group) : null;
  if (thumb) {
    return <Image source={{ uri: thumb }} contentFit="cover" style={StyleSheet.absoluteFill} />;
  }
  return group.vendor ? (
    <Icon name="storefront-outline" size={size * 0.45} color="#FFFFFF" />
  ) : (
    <AppText variant="caption" weight={700} color="onPhoto" maxFontSizeMultiplier={1}>
      {initials(group.name)}
    </AppText>
  );
}
