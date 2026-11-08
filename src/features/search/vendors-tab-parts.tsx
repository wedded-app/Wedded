import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { useMyRequests } from '@/data/requests';
import { useSavedVendors } from '@/data/saved';
import { useSession } from '@/features/auth/session';
import { placeName } from '@/features/location/place-name';
import { useSearchLocation } from '@/features/location/search-location';
import { useLocale } from '@/i18n/locale-context';

import { KindCircle } from './kind-circle';

/**
 * Under the Vendors title: "Browse vendors near Sacramento, CA", the city
 * underlined (2026-11-08). The whole line opens "Where should we look?".
 * With no city yet: "Browse vendors anywhere. Choose a city".
 */
export function NearPlace() {
  const styles = useStyles();
  const { t } = useLocale();
  const { place, openLocationSheet } = useSearchLocation();
  const name = place ? placeName(place.label, t) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        name ? t('vendorsTab.nearSpoken', { place: name }) : t('vendorsTab.choosePlace')
      }
      accessibilityHint={t('location.chip.hint')}
      onPress={openLocationSheet}
      hitSlop={{ top: 12, bottom: 12 }}
      style={({ pressed }) => [styles.near, pressed && styles.pressed]}
    >
      <AppText variant="bodyLg" color="text2">
        {name ? t('vendorsTab.browseNear') : t('vendorsTab.browseAnywhere')}{' '}
        <AppText variant="bodyLg" weight={600} style={styles.underline}>
          {name ?? t('vendorsTab.choosePlace')}
        </AppText>
      </AppText>
    </Pressable>
  );
}

/**
 * Saved and Requests side by side, small: the vendors kept with the heart
 * (opens Saved) and the requests still open (opens Requests).
 */
export function YourVendors({ weddingId }: { weddingId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const saves = useSavedVendors();
  const requests = useMyRequests(weddingId);
  const savedCount = signedIn ? new Set((saves.data ?? []).map((save) => save.vendorId)).size : 0;
  const openCount = signedIn
    ? (requests.data ?? []).filter((r) => r.status === 'open' && !r.expired).length
    : 0;

  return (
    <View style={styles.pair}>
      <SmallButton
        icon="heart-outline"
        label={t('vendorsTab.saved')}
        value={String(savedCount)}
        spoken={
          savedCount > 0
            ? t('vendorsTab.savedCount', { count: savedCount })
            : t('vendorsTab.savedNone')
        }
        onPress={() => router.push('/saved')}
      />
      <SmallButton
        icon="paper-plane-outline"
        label={t('vendorsTab.requests')}
        value={openCount > 0 ? t('vendorsTab.requestsCount', { count: openCount }) : null}
        spoken={
          openCount > 0
            ? t('vendorsTab.requestsCount', { count: openCount })
            : t('vendorsTab.requestsNone')
        }
        onPress={() => router.push('/requests')}
      />
    </View>
  );
}

function SmallButton({
  icon,
  label,
  value,
  spoken,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string | null;
  spoken: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${spoken}`}
      onPress={onPress}
      style={({ pressed }) => [styles.small, pressed && styles.smallPressed]}
    >
      <Icon name={icon} size={Sizes.iconSmall * scale} color={Colors.text} />
      <AppText weight={600} numberOfLines={1} style={styles.grow}>
        {label}
      </AppText>
      {value ? (
        <AppText color="text2" numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Browse categories: round photos of the kinds of vendor, swiped sideways. */
export function KindsRow({
  kinds,
  onOpen,
}: {
  kinds: EventNeed[];
  onOpen: (kind: EventNeed) => void;
}) {
  const styles = useStyles();
  const scale = useFontScale('label');
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.kinds}
    >
      {kinds.map((kind) => (
        <KindCircle
          key={kind.categorySlug}
          kind={kind}
          size={76}
          // Wide enough for "Photographer" on one line, and the next circle
          // still peeks in at the edge to show the row scrolls
          width={Math.round(102 * Math.min(scale, 1.3))}
          onPress={() => onOpen(kind)}
        />
      ))}
    </ScrollView>
  );
}

/** The card at the bottom of the tab: say what you need, vendors send offers. */
export function RequestsCard() {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.requests}>
      <AppText variant="heading" accessibilityRole="header">
        {t('vendorsTab.requestsCardTitle')}
      </AppText>
      <AppText color="text2">{t('vendorsTab.requestsCardBody')}</AppText>
      <Button
        label={t('vendorsTab.requestsCardButton')}
        onPress={() => router.push('/requests')}
        style={styles.requestsButton}
      />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  near: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
  underline: {
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.md - 2,
  },
  small: {
    flex: 1,
    minHeight: Sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
  smallPressed: {
    backgroundColor: Colors.rowPressed,
  },
  grow: {
    flex: 1,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  kinds: {
    gap: Spacing.xs,
    paddingHorizontal: Sizes.pageGutter - Spacing.sm,
  },
  requests: {
    gap: Spacing.xs + 2,
    padding: Spacing.xl - 4,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  requestsButton: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
}));
