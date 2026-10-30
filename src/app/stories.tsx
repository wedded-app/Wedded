import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { storyRingStyle } from '@/components/story-ring';
import { backgroundCss, Radius, Spacing, useColors } from '@/constants/theme';
import type { StoryGroup } from '@/data/stories';
import { useSession } from '@/features/auth/session';
import { timeAgo } from '@/features/requests/requests-format';
import { latestThumb, StoryFace, useStoryTray } from '@/features/stories/stories-bar';
import { useLocale } from '@/i18n/locale-context';

const bottomShade = backgroundCss('linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))');

type Item = { mine: true; group: StoryGroup | undefined } | { mine: false; group: StoryGroup };

/**
 * Stories (opened from the ring at the top left of Reels): everyone's
 * stories from the last 24 hours as tall cards, two across, like Snapchat's.
 * Your story comes first (a big plus to add one), then the people with
 * something new, then the ones already watched. A card plays that person's
 * stories; pull down to look again.
 */
export default function StoriesScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const { query, groups, seen } = useStoryTray();
  const others = groups.filter((g) => !g.isMine);
  const items: Item[] = [
    { mine: true, group: groups.find((g) => g.isMine) },
    ...others.map((group) => ({ mine: false as const, group })),
  ];

  const close = () => (router.canGoBack() ? router.back() : router.navigate('/discover'));
  const add = () => requireSignIn(() => router.push('/post-story'));
  const watch = (group: StoryGroup) =>
    router.push({ pathname: '/story', params: { group: group.key } });

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} title={t('stories.title')} />
      {query.isError && !query.data ? (
        <StateView state="error" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.mine ? 'mine' : item.group.key)}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          renderItem={({ item }) =>
            item.mine && !item.group ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('stories.add')}
                onPress={add}
                style={({ pressed }) => [
                  styles.card,
                  styles.addCard,
                  { backgroundColor: Colors.primaryTint },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.plus, { backgroundColor: Colors.primary }]}>
                  <Icon name="add" size={32} color="#FFFFFF" weight="bold" />
                </View>
                <AppText weight={700} style={styles.center}>
                  {t('stories.add')}
                </AppText>
                <AppText variant="label" weight={400} color="text2" style={styles.center}>
                  {t('postStory.showsFor')}
                </AppText>
              </Pressable>
            ) : item.group ? (
              <StoryCard
                group={item.group}
                watched={seen(item.group)}
                onPress={() => watch(item.group!)}
                onAdd={item.mine ? add : undefined}
              />
            ) : null
          }
          ListFooterComponent={
            query.isPending ? (
              <StateView state="loading" />
            ) : others.length === 0 ? (
              <AppText color="text2" style={[styles.center, styles.empty]}>
                {t('stories.empty')}
              </AppText>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

/** One person's stories: their newest as the cover, their ring, name and when. */
function StoryCard({
  group,
  watched,
  onPress,
  onAdd,
}: {
  group: StoryGroup;
  watched: boolean;
  onPress: () => void;
  /** Your own card: a plus to add another. */
  onAdd?: () => void;
}) {
  const Colors = useColors();
  const { t } = useLocale();
  const name = group.isMine ? t('stories.yours') : (group.name ?? t('reels.someone'));
  const thumb = latestThumb(group);
  const when = timeAgo(group.stories[group.stories.length - 1].createdAt, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        group.isMine
          ? t('stories.mineSpoken', { time: when })
          : t('stories.cardSpoken', { name, time: when })
      }
      onPress={onPress}
      // A clip without a still shows the brand's maroon behind the name
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: Colors.primary },
        pressed && styles.pressed,
      ]}
    >
      {thumb && (
        <Image
          source={{ uri: thumb }}
          contentFit="cover"
          transition={150}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.shade, bottomShade]} />
      <View style={[styles.ring, watched ? styles.ringSeen : storyRingStyle]}>
        <View style={styles.face}>
          <StoryFace group={group} size={36} />
        </View>
      </View>
      <View style={styles.words}>
        <AppText weight={700} color="onPhoto" numberOfLines={2} style={styles.shadowed}>
          {name}
        </AppText>
        <View style={styles.whenRow}>
          <AppText variant="caption" color="onPhoto" numberOfLines={1} style={styles.soft}>
            {when}
          </AppText>
          {group.isSample && (
            <View style={styles.tag} accessible accessibilityLabel={t('sample.label')}>
              <AppText variant="caption" weight={700} color="onPhoto">
                {t('sample.tag')}
              </AppText>
            </View>
          )}
        </View>
      </View>
      {onAdd && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('stories.add')}
          onPress={onAdd}
          hitSlop={6}
          style={({ pressed }) => [
            styles.addMore,
            { backgroundColor: Colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="add" size={22} color="#FFFFFF" weight="bold" />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  columns: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48.5%',
    aspectRatio: 9 / 16,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  plus: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  pressed: {
    opacity: 0.75,
  },
  center: {
    textAlign: 'center',
  },
  empty: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  ring: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2.5,
  },
  ringSeen: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  face: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,28,51,0.95)',
  },
  words: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    bottom: Spacing.sm,
    gap: 2,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  soft: {
    opacity: 0.9,
  },
  shadowed: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  addMore: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
