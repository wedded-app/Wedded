import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { ProgressBar } from '@/components/progress-bar';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing, Springs, useColors } from '@/constants/theme';
import { useSavedVendors } from '@/data/saved';
import {
  DHOL,
  LIBRARY,
  PHOTOGRAPHERS,
  PHOTOS,
  type LibraryList,
  type MockVendor,
} from '@/features/wed/mock';
import { useWed, type WedState } from '@/features/wed/wed-store';
import { WedCloseButton } from '@/features/wed/close-wed';
import { openFromWed, WED_BACK } from '@/features/wed/open-wed';
import { Motion } from '@/lib/motion';

type Side = 'lists' | 'photos';
type Photo = { key: string; uri: string; blurhash?: string; label: string };

const COLUMNS = 3;

/**
 * Lists and photos: what Wed has made and kept for the family. Lists either
 * open a screen (saved vendors, the dhol players side by side) or open in
 * place (the budget, the Jaago's timings, vendor emails once Gmail is
 * connected, and the Jaago list once a heart in the chat saves to it).
 * Saved shows how many vendors the account has saved, as /saved does.
 * Photos are the ones sent to Wed, then ones from vendors.
 */
export default function WedLibraryScreen() {
  const [side, setSide] = useState<Side>('lists');
  const gmail = useWed((s) => s.apps.gmail.status);
  const jaago = useWed(jaagoList);
  const { data: saves } = useSavedVendors();
  const savedCount = new Set(saves?.map((save) => save.vendorId)).size;
  const lists = [
    ...(jaago ? [jaago] : []),
    ...LIBRARY.filter(
      (list) => !list.afterGmail || gmail === 'preview' || gmail === 'connected',
    ).map((list) =>
      list.id === 'saved'
        ? { ...list, value: savedCount > 0 ? String(savedCount) : undefined }
        : list,
    ),
  ];
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) =>
    setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const photos = useWed(sentPhotos);

  return (
    <NavScreen title="Lists and photos" backTo={WED_BACK} trailing={<WedCloseButton />}>
      <Segmented
        options={[
          { value: 'lists', label: 'Lists' },
          { value: 'photos', label: 'Photos' },
        ]}
        value={side}
        onChange={setSide}
        accessibilityLabel="Show lists or photos"
      />

      {side === 'lists' ? (
        <Animated.View key="lists" entering={Motion.enter}>
          <ListSection inset>
            {lists.map((list) =>
              list.rows ? (
                <ListDisclosure
                  key={list.id}
                  list={list}
                  open={open.includes(list.id)}
                  onToggle={() => toggle(list.id)}
                />
              ) : (
                <LinkRow key={list.id} list={list} />
              ),
            )}
          </ListSection>
        </Animated.View>
      ) : (
        <Animated.View key="photos" entering={Motion.enter}>
          <PhotoGrid photos={[...photos, ...SAMPLE_PHOTOS]} />
        </Animated.View>
      )}
    </NavScreen>
  );
}

// Vendors saved from Wed's cards in the chat, as a list that opens in place
const JAAGO_VENDORS: MockVendor[] = [...DHOL, ...PHOTOGRAPHERS];
function jaagoList(s: WedState): LibraryList | null {
  if (s.saved.length === 0) return null;
  const rows = s.saved.flatMap((slug) => {
    const vendor = JAAGO_VENDORS.find((v) => v.slug === slug);
    return vendor ? [{ label: vendor.name, value: vendor.price }] : [];
  });
  return {
    id: 'jaago-list',
    title: 'Jaago list',
    icon: 'heart-outline',
    meta: 'Saved from Wed · Today',
    rows,
  };
}

const SAMPLE_PHOTOS: Photo[] = PHOTOS.map((photo, index) => ({
  key: `sample-${index}`,
  uri: photo.uri,
  blurhash: photo.blurhash,
  label: `Photo from ${photo.credit}`,
}));

// Photos the family sent Wed in the chat, newest first
function sentPhotos(s: WedState): Photo[] {
  return s.items
    .flatMap((item) =>
      item.kind === 'me' && item.photo
        ? [{ key: item.key, uri: item.photo, label: 'A photo you sent Wed' }]
        : [],
    )
    .reverse();
}

/** A list that opens its own screen (Saved, or the dhol players side by side), on the tab under Wed's sheet. */
function LinkRow({ list }: { list: LibraryList }) {
  const href = list.href;
  return (
    <ListRow
      icon={list.icon}
      iconColor="text"
      title={list.title}
      subtitle={list.meta}
      value={list.value}
      accessibilityRole="link"
      onPress={href ? () => openFromWed(href) : undefined}
    />
  );
}

/**
 * A list that opens in place: its rows (with the time first for a day's
 * timings), and for the budget a bar of how much is spent.
 */
function ListDisclosure({
  list,
  open,
  onToggle,
}: {
  list: LibraryList;
  open: boolean;
  onToggle: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  const timeline = list.id === 'jaago';
  // A long value ("$18,400 of $45,000") reads under the title, where it has
  // room; who made the list moves to the bottom of the open list
  const subtitle = list.value ?? list.meta;
  const footnote = list.value ? list.meta : undefined;
  const spent = spentShare(list.value);

  return (
    <Animated.View layout={Motion.layout}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={[list.title, subtitle].filter(Boolean).join(', ')}
        accessibilityHint={open ? 'Closes the list' : 'Opens the list here'}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.slot, { width: Sizes.rowIcon * Math.min(scale, 1.4) }]}>
          <Icon name={list.icon} size={Sizes.icon * Math.min(scale, 1.4)} color={Colors.text} />
        </View>
        <View style={styles.grow}>
          <AppText>{list.title}</AppText>
          {subtitle ? (
            <AppText variant="label" weight={400} color="text2">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Disclosure open={open} />
      </Pressable>

      {open && list.rows ? (
        <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.inside}>
          {spent !== null ? (
            <ProgressBar
              value={spent}
              color={Colors.text}
              trackColor={Colors.fill}
              style={styles.bar}
            />
          ) : null}
          {list.rows.map((row, index) => (
            <View
              key={row.label}
              accessible
              style={[styles.item, index > 0 && styles.itemLine, timeline && styles.timed]}
            >
              {timeline ? (
                <>
                  <AppText
                    variant="label"
                    weight={600}
                    color="text2"
                    style={{ width: TIME_WIDTH * Math.min(scale, 1.6) }}
                  >
                    {row.value}
                  </AppText>
                  <AppText style={styles.grow}>{row.label}</AppText>
                </>
              ) : (
                <>
                  <AppText style={styles.grow}>{row.label}</AppText>
                  {row.value ? (
                    <AppText color="text2" style={styles.value}>
                      {row.value}
                    </AppText>
                  ) : null}
                </>
              )}
            </View>
          ))}
          {footnote ? (
            <AppText variant="label" weight={400} color="text2" style={styles.footnote}>
              {footnote}
            </AppText>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// "$18,400 of $45,000" as 0.41; null for any other value
function spentShare(value: string | undefined): number | null {
  const amounts = value?.match(/^\$([\d,]+) of \$([\d,]+)$/);
  if (!amounts) return null;
  const [spent, total] = [amounts[1], amounts[2]].map((n) => Number(n.replace(/,/g, '')));
  return total > 0 ? spent / total : null;
}

/** Three square photos to a row, with thin gaps, like the Photos app. */
function PhotoGrid({ photos }: { photos: Photo[] }) {
  const styles = useStyles();
  if (photos.length === 0) {
    return (
      <StateView state="empty" icon="images-outline" message="Photos you send Wed show up here." />
    );
  }
  const rows: Photo[][] = [];
  for (let i = 0; i < photos.length; i += COLUMNS) rows.push(photos.slice(i, i + COLUMNS));

  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: COLUMNS }, (_, c) => {
            const photo = row[c];
            if (!photo) return <View key={`empty-${c}`} style={styles.cell} />;
            return (
              <Image
                key={photo.key}
                source={{ uri: photo.uri }}
                placeholder={photo.blurhash ? { blurhash: photo.blurhash } : undefined}
                contentFit="cover"
                transition={200}
                accessible
                accessibilityLabel={photo.label}
                style={[styles.cell, styles.photo]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The chevron on a row that opens in place: down when closed, turning up when open. */
function Disclosure({ open }: { open: boolean }) {
  const Colors = useColors();
  const scale = useFontScale('body');
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 180 : 0);

  useEffect(() => {
    const to = open ? 180 : 0;
    turn.value = reduceMotion ? to : withSpring(to, Springs.snappy);
  }, [open, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon
        name="chevron-down"
        size={17 * Math.min(scale, 1.4)}
        color={Colors.chevron}
        weight="semibold"
      />
    </Animated.View>
  );
}

// Where a row's text starts after its icon slot: the open list lines up with it
const TEXT_INSET = Spacing.lg + Sizes.rowIcon + Spacing.md;
// Room for "10:30 PM" before a timing's words
const TIME_WIDTH = 76;

const useStyles = makeStyles((Colors) => ({
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  slot: {
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  inside: {
    paddingLeft: TEXT_INSET,
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  bar: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  item: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  itemLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  timed: {
    alignItems: 'baseline',
  },
  value: {
    flexShrink: 0,
    textAlign: 'right',
  },
  footnote: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  grid: {
    gap: Spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
  },
  photo: {
    borderRadius: Radius.thumb,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
}));
