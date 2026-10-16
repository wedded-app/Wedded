import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { StoryRing } from '@/components/story-ring';
import { Sizes, Spacing } from '@/constants/theme';
import type { StoryGroup } from '@/data/stories';
import { useSession } from '@/features/auth/session';
import { useLocale } from '@/i18n/locale-context';

import { latestThumb, useStoryTray } from './stories-bar';

/**
 * Stories on Home, like Instagram's row: Your story first, then everyone
 * with a story (new ones in the coloured ring, watched ones grey). A ring
 * plays the stories feed from that person on; Your story plays yours, or
 * adds one. Hidden while nobody has a story.
 */
export function StoryRings() {
  const router = useRouter();
  const { t } = useLocale();
  const { requireSignIn } = useSession();
  const { groups, seen } = useStoryTray();
  if (groups.length === 0) return null;

  const mine = groups.find((group) => group.isMine);
  const others = groups.filter((group) => !group.isMine);
  const watch = (group: StoryGroup) =>
    router.push({ pathname: '/story', params: { group: group.key } });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.track}
    >
      <StoryRing
        label={t('stories.yours')}
        accessibilityLabel={mine ? t('stories.yours') : t('stories.add')}
        photoUrl={mine ? latestThumb(mine) : null}
        icon="add"
        seen={!mine || seen(mine)}
        onPress={() => (mine ? watch(mine) : requireSignIn(() => router.push('/post-story')))}
      />
      {others.map((group) => {
        const name = group.name ?? t('reels.someone');
        return (
          <StoryRing
            key={group.key}
            label={name}
            accessibilityLabel={t('stories.watch', { name })}
            photoUrl={latestThumb(group)}
            icon={group.vendor ? 'storefront-outline' : 'person-outline'}
            seen={seen(group)}
            onPress={() => watch(group)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Edge to edge, like the other rows on Home
  scroll: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    paddingHorizontal: Sizes.pageGutter - Spacing.xs,
  },
});
