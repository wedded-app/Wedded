import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow } from '@/components/list';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useMySiteSlug, useSitePage } from '@/data/website';
import { useLocale } from '@/i18n/locale-context';

import { useSiteFonts } from './fonts';
import { SiteCover } from './site-cover';

/** The site's state in a few words, for Home and My Wedding. */
function useSiteStatus(weddingId: string) {
  const { t } = useLocale();
  const slug = useMySiteSlug(weddingId);
  const page = useSitePage(slug.data ?? '');
  const site = page.data?.kind === 'page' ? page.data.page : null;
  const status = !slug.data
    ? t('website.card.new')
    : site?.publishedAt
      ? t('website.card.live')
      : t('website.card.draft');
  return { slug: slug.data ?? null, site, status, loading: slug.isPending };
}

/**
 * Home's way to the wedding website, right under the wedding card so it's
 * easy to find: the site's cover small on the left, and whether it's a
 * draft or live. Before there's a site it says it's already filled in.
 */
export function WebsiteCard({ weddingId, canEdit }: { weddingId: string; canEdit: boolean }) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const fontsReady = useSiteFonts();
  const { slug, site, status, loading } = useSiteStatus(weddingId);
  const [thumbWidth, setThumbWidth] = useState(0);
  if (loading || (!slug && !canEdit)) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${slug ? t('website.card.title') : t('website.card.make')}. ${status}`}
      onPress={() => router.push('/website')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        style={[styles.thumb, { pointerEvents: 'none' }]}
        onLayout={(e: LayoutChangeEvent) => setThumbWidth(Math.round(e.nativeEvent.layout.width))}
      >
        {site && fontsReady && thumbWidth > 0 ? (
          <SiteCover data={site} width={thumbWidth} mini id="home-card" minHeight={124} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="globe-outline" size={30} color={Colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <AppText variant="label" weight={600} color="text2">
          {t('website.title')}
        </AppText>
        <AppText variant="heading">
          {slug ? t('website.card.title') : t('website.card.make')}
        </AppText>
        <AppText variant="label" weight={400} color={site?.publishedAt ? 'success' : 'text2'}>
          {status}
        </AppText>
      </View>
      <Icon name="chevron-forward" size={18} color={Colors.chevron} weight="semibold" />
    </Pressable>
  );
}

/** The Website row at the top of My Wedding's list. */
export function WebsiteRow({ weddingId }: { weddingId: string }) {
  const { t } = useLocale();
  const { status } = useSiteStatus(weddingId);
  return (
    <ListRow
      icon="globe-outline"
      title={t('website.title')}
      subtitle={status}
      onPress={() => router.push('/website')}
    />
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  thumb: {
    width: 92,
    height: 124,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
