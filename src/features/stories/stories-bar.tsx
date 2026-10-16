import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StoryRing, storyRingStyle } from '@/components/story-ring';
import { Spacing } from '@/constants/theme';
import { type StoryGroup, useStories } from '@/data/stories';
import { useSession } from '@/features/auth/session';
import { initials } from '@/features/planner/plan-together';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { groupSeen, trayOrder, useStorySeen } from './seen-stories';

const MINI = 30;

/** The poster's newest still for their ring. */
const latestThumb = (group: StoryGroup) =>
  [...group.stories].reverse().find((story) => story.thumbUrl)?.thumbUrl ?? null;

/** Everyone's stories in ring order, with which are watched. */
export function useStoryTray() {
  const stories = useStories();
  const isSeen = useStorySeen();
  const groups = trayOrder(stories.data ?? [], isSeen);
  const seen = (group: StoryGroup) => groupSeen(group, isSeen);
  return { groups, seen, fresh: groups.filter((g) => !g.isMine && !seen(g)).length };
}

/**
 * Stories on the Reels tab, kept out of the video's way: a small stack of the
 * newest rings at the top left (where the camera sits on the right), with a
 * chevron that says it opens. Tapping it drops the row of rings below
 * Following and For you; tapping again folds it away.
 */
export function StoriesButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const { t } = useLocale();
  const { groups, seen, fresh } = useStoryTray();
  const faces = groups.filter((g) => !g.isMine).slice(0, 3);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fresh > 0 ? t('stories.button', { count: fresh }) : t('stories.title')}
      accessibilityState={{ expanded: open }}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.stack}>
        {faces.length === 0 ? (
          <View style={[styles.mini, styles.miniSeen]}>
            <View style={styles.miniInner}>
              <Icon name="add" size={18} color="#FFFFFF" weight="bold" />
            </View>
          </View>
        ) : (
          faces.map((group, i) => (
            <View
              key={group.key}
              style={[
                styles.mini,
                seen(group) ? styles.miniSeen : storyRingStyle,
                i > 0 && styles.overlap,
                { zIndex: faces.length - i },
              ]}
            >
              <Face group={group} />
            </View>
          ))
        )}
      </View>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#FFFFFF" />
    </Pressable>
  );
}

function Face({ group }: { group: StoryGroup }) {
  const thumb = latestThumb(group);
  return (
    <View style={styles.miniInner}>
      {thumb ? (
        <Image source={{ uri: thumb }} contentFit="cover" style={styles.miniPhoto} />
      ) : group.vendor ? (
        <Icon name="storefront-outline" size={14} color="#FFFFFF" />
      ) : (
        <AppText variant="caption" weight={700} color="onPhoto" maxFontSizeMultiplier={1}>
          {initials(group.name)}
        </AppText>
      )}
    </View>
  );
}

/** The row of rings: Your story first (add one, or watch yours), then everyone. */
export function StoriesRow() {
  const router = useRouter();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const { groups, seen } = useStoryTray();
  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  const watch = (group: StoryGroup) =>
    router.push({ pathname: '/story', params: { group: group.key } });

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rings}
      >
        {mine ? (
          <StoryRing
            onVideo
            size={60}
            photoUrl={latestThumb(mine)}
            icon="person-outline"
            label={t('stories.yours')}
            seen={seen(mine)}
            accessibilityLabel={t('stories.watchYours')}
            onPress={() => watch(mine)}
          />
        ) : (
          <StoryRing
            onVideo
            size={60}
            icon="add"
            label={t('stories.yours')}
            seen
            accessibilityLabel={t('stories.add')}
            onPress={() => requireSignIn(() => router.push('/post-story'))}
          />
        )}
        {others.map((group) => {
          const name = group.name ?? t('reels.someone');
          return (
            <StoryRing
              key={group.key}
              onVideo
              size={60}
              photoUrl={latestThumb(group)}
              icon={group.vendor ? 'storefront-outline' : 'person-outline'}
              label={name}
              seen={seen(group)}
              accessibilityLabel={t('stories.watch', { name })}
              onPress={() => watch(group)}
            />
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flexDirection: 'row',
  },
  mini: {
    width: MINI,
    height: MINI,
    borderRadius: MINI / 2,
    padding: 2,
  },
  miniSeen: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  overlap: {
    marginLeft: -12,
  },
  miniInner: {
    flex: 1,
    borderRadius: MINI / 2,
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,28,51,0.95)',
  },
  miniPhoto: {
    ...StyleSheet.absoluteFill,
  },
  row: {
    alignSelf: 'stretch',
    flexGrow: 0,
    marginTop: Spacing.sm,
  },
  rings: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
