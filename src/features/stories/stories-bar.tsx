import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { storyRingStyle } from '@/components/story-ring';
import { type StoryGroup, useStories } from '@/data/stories';
import { initials } from '@/features/planner/plan-together';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { groupSeen, trayOrder, useStorySeen } from './seen-stories';

const RING = 40;

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

/**
 * Stories on the Reels tab: one ring at the top left, mirroring the camera,
 * with the newest story's face and a count of the people with new ones. It
 * opens the Stories page; nothing else covers the video. With no stories
 * yet it's a coloured ring with a plus, an invitation rather than a grey dot.
 */
export function StoriesButton() {
  const router = useRouter();
  const { t } = useLocale();
  const { groups, seen, fresh } = useStoryTray();
  const others = groups.filter((g) => !g.isMine);
  // Someone with something new, else whoever posted last
  const face = others.find((g) => !seen(g)) ?? others[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fresh > 0 ? t('stories.button', { count: fresh }) : t('stories.title')}
      onPress={() => {
        selectionHaptic();
        router.push('/stories');
      }}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={[styles.ring, face && fresh === 0 ? styles.ringSeen : storyRingStyle]}>
        <View style={styles.inner}>
          {face ? (
            <StoryFace group={face} size={RING} photo />
          ) : (
            <Icon name="add" size={20} color="#FFFFFF" weight="bold" />
          )}
        </View>
      </View>
      {fresh > 0 && (
        <View style={styles.badge}>
          <AppText
            variant="caption"
            weight={700}
            color="onPhoto"
            maxFontSizeMultiplier={1}
            style={styles.badgeText}
          >
            {fresh > 9 ? '9+' : fresh}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    padding: 2.5,
  },
  ringSeen: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  inner: {
    flex: 1,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,28,51,0.95)',
  },
  // The count sits on the ring's top right, like an unread badge
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B5C',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
