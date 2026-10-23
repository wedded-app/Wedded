import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { CategoryGroup, EventNeed } from '@/data/reference';
import { useVendorSearch } from '@/data/search';
import { photoUrl } from '@/data/vendor-media';
import { useSearchLocation } from '@/features/location/search-location';
import { filtersForGuests } from '@/features/planner/find-for-plan';
import { NO_FILTERS } from '@/features/search/search-filters';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

// Counting stops here ("50+ free")
const COUNT_LIMIT = 50;

/**
 * "What the Mehndi still needs": a photo tile for each kind of vendor the
 * picked event hasn't booked, with how many are free on its day (the final
 * look, 2026-10-23). A tap opens that kind's results for the day.
 */
export function NeedTiles({
  needs,
  date,
  dayLabel,
  guestBand,
  onOpen,
}: {
  needs: EventNeed[];
  date: string | null;
  dayLabel: string | null;
  guestBand: string | null;
  onOpen: (need: EventNeed) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {needs.map((need, index) => (
        <Animated.View
          key={need.categorySlug}
          entering={Motion.stagger(index)}
          style={styles.tileSlot}
        >
          <NeedTile
            need={need}
            date={date}
            dayLabel={dayLabel}
            guestBand={guestBand}
            onOpen={() => onOpen(need)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function NeedTile({
  need,
  date,
  dayLabel,
  guestBand,
  onOpen,
}: {
  need: EventNeed;
  date: string | null;
  dayLabel: string | null;
  guestBand: string | null;
  onOpen: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { place, maxMiles } = useSearchLocation();
  const search = useVendorSearch({
    latitude: place?.latitude,
    longitude: place?.longitude,
    maxMiles,
    categorySlug: need.categorySlug,
    filters: {
      ...NO_FILTERS,
      ...filtersForGuests(need.groupSlug, guestBand ?? undefined),
      availableOn: date,
    },
    limit: COUNT_LIMIT,
  });
  const results = search.data ?? [];
  const cover = results.find((vendor) => vendor.coverPath)?.coverPath ?? null;
  const shown = results.length >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : String(results.length);
  const name = localized(need.name);
  const line = search.isPending
    ? ' '
    : results.length === 0
      ? t('home.noneYet')
      : date && dayLabel
        ? t('vendorsTab.freeOn', { shown, day: dayLabel })
        : t('vendorsTab.nearYou', { shown });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${line}`}
      pressedScale={0.97}
      onPress={() => {
        selectionHaptic();
        onOpen();
      }}
      style={styles.tile}
    >
      <View style={styles.tilePhoto}>
        {cover ? (
          <Image
            source={{ uri: photoUrl(cover, 'medium') }}
            contentFit="cover"
            transition={200}
            style={styles.fill}
          />
        ) : (
          <View style={[styles.fill, styles.noPhoto]}>
            <Icon name={groupIcon(need.groupSlug)} size={36} color={Colors.primary} />
          </View>
        )}
      </View>
      <AppText variant="heading" weight={600} numberOfLines={2}>
        {name}
      </AppText>
      <AppText variant="caption" weight={600} color="success" numberOfLines={1}>
        {line}
      </AppText>
    </PressableScale>
  );
}

/** Calm rows with a tick: who's already booked for the picked event. */
export function BookedRows({
  rows,
}: {
  rows: { key: string; kind: string; vendor: { slug: string; name: string } | null }[];
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.rows}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole={row.vendor ? 'link' : undefined}
          disabled={!row.vendor}
          onPress={() =>
            row.vendor && router.push({ pathname: '/v/[slug]', params: { slug: row.vendor.slug } })
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.tick}>
            <Icon name="checkmark" size={13} color={Colors.onPrimary} weight="bold" />
          </View>
          <View style={styles.grow}>
            <AppText weight={600} numberOfLines={1}>
              {row.vendor?.name ?? row.kind}
            </AppText>
            {row.vendor && (
              <AppText variant="caption" color="text2" numberOfLines={1}>
                {row.kind}
              </AppText>
            )}
          </View>
          {row.vendor && (
            <Icon name="chevron-forward" size={16} color={Colors.chevron} weight="semibold" />
          )}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Every kind of vendor: the groups from the database (Venues to Services),
 * each opening straight down to its kinds as chips; a kind opens its results.
 */
export function KindsAccordion({ groups }: { groups: CategoryGroup[] }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={styles.rows}>
      {groups.map((group) => {
        const isOpen = open === group.slug;
        return (
          <View key={group.slug} style={styles.groupWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => {
                selectionHaptic();
                setOpen(isOpen ? null : group.slug);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Icon name={groupIcon(group.slug)} size={22} color={Colors.primary} />
              <AppText weight={500} style={styles.grow} numberOfLines={1}>
                {localized(group.name)}
              </AppText>
              <AppText variant="caption" color="text2">
                {t('vendorsTab.kindsCount', { count: group.categories.length })}
              </AppText>
              <Icon
                name={isOpen ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={Colors.chevron}
                weight="semibold"
              />
            </Pressable>
            {isOpen && (
              <Animated.View entering={Motion.enter} style={styles.kinds}>
                {group.categories.map((category) => (
                  <PressableScale
                    key={category.slug}
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({
                        pathname: '/c/[category]',
                        params: { category: category.slug },
                      })
                    }
                    style={styles.kind}
                  >
                    <AppText variant="label" weight={500}>
                      {localized(category.name)}
                    </AppText>
                  </PressableScale>
                ))}
              </Animated.View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** The Requests card at the bottom of the tab: say what you need, vendors send offers. */
export function RequestsCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <PressableScale
      accessibilityRole="button"
      pressedScale={0.98}
      onPress={() => router.push('/requests')}
      style={styles.requests}
    >
      <View style={styles.grow}>
        <AppText variant="caption" weight={600} color="primary" style={styles.caps}>
          {t('vendorsTab.requests').toUpperCase()}
        </AppText>
        <AppText variant="heading" weight={600}>
          {t('vendorsTab.requestsCardTitle')}
        </AppText>
      </View>
      <Icon name="arrow-forward" size={20} color={Colors.text} weight="semibold" />
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tileSlot: {
    width: '47.5%',
    flexGrow: 1,
  },
  tile: {
    gap: Spacing.xs,
  },
  tilePhoto: {
    height: 170,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  groupWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pressed: {
    opacity: 0.6,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
  },
  grow: {
    flex: 1,
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  kind: {
    minHeight: 40,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    borderRadius: Radius.chip,
    backgroundColor: Colors.surface,
  },
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
  },
  caps: {
    letterSpacing: 0.6,
  },
}));
