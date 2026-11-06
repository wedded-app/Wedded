import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { useNavTop } from '@/components/nav';
import { Icon } from '@/components/icon';
import { OmbreBackground } from '@/components/ombre-background';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useWeddingMembers } from '@/data/wedding';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { useCountUp } from '@/lib/use-count-up';

import { mainDay } from './days';
import type { usePlanDays } from './use-plan-days';
import type { usePlanView } from './use-plan-view';
import { countdown, faceList, weddingDays, type Face } from './wedding-tab';

type PlanView = ReturnType<typeof usePlanView>;
type PlanDays = ReturnType<typeof usePlanDays>;

// The small tracked line, as on Home's wedding card
const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

/** "SAT, JUN 12": a day as the line under the count says it. */
function shortDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

/**
 * The top of the Wedding tab (Fezy, 2026-11-06): the slowly moving ombre of
 * Home's wedding card across the top of the screen, under the status bar,
 * with the couple's names, the days counting down to the main day (the
 * Nikah, the Anand Karaj) and which day that is, the faces of everyone
 * planning, and Your days to see and change every event's day. Before
 * there's a day it asks when the wedding is. Its height is HERO_HEIGHT, so
 * the page can turn the bar back to white once it scrolls away.
 */
export function WeddingHero({
  view,
  days,
  onFamily,
}: {
  view: PlanView;
  days: PlanDays;
  onFamily: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const navTop = useNavTop();
  const { height } = useWindowDimensions();
  const { wedding, canEdit } = view;
  const title = wedding?.title?.trim() || null;

  // The main day, else the first; the count runs to it
  const main = mainDay(days.events, days.state.dates);
  const all = weddingDays(null, days.state.dates, days.order);
  const target = main ?? all[0] ?? null;
  const left = countdown(all, target);
  const toGo = left?.kind === 'toGo' ? left.days : 0;
  const shown = useCountUp(toGo);
  const mainEvent = target
    ? days.events.find((event) => days.state.dates[event.slug] === target)
    : undefined;
  const openDays = () => {
    selectionHaptic();
    router.push('/plan-days');
  };

  return (
    <View
      style={[
        styles.hero,
        {
          marginTop: -navTop,
          paddingTop: navTop + Spacing.md,
          minHeight: heroHeight(height),
        },
      ]}
    >
      {/* Pulled down past the top, the page shows more ombre, not white */}
      <View style={styles.above} />
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <OmbreBackground />
      </View>

      <View style={styles.nameRow}>
        <View style={styles.grow}>
          {title && (
            <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
              {t('planner.yourWedding').toUpperCase()}
            </AppText>
          )}
          <AppText
            variant="display"
            weight={800}
            color="onHero"
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title ?? t('planner.yourWedding')}
          </AppText>
        </View>
        {wedding && <Faces weddingId={wedding.id} onPress={onFamily} />}
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          left?.kind === 'toGo' && mainEvent
            ? t('planner.hero.countLabel', {
                count: toGo,
                event: localized(mainEvent.name),
                date: shortDay(target!),
              })
            : t('planner.hero.ask')
        }
        accessibilityHint={t('planner.hero.daysHint')}
        pressedScale={0.98}
        disabled={!canEdit}
        onPress={openDays}
        style={styles.count}
      >
        {left?.kind === 'toGo' ? (
          <>
            <View style={styles.countRow}>
              <AppText
                weight={800}
                color="onHero"
                style={styles.number}
                maxFontSizeMultiplier={1.3}
              >
                {String(shown)}
              </AppText>
              <AppText variant="heading" weight={800} color="onHero" style={styles.upper}>
                {t('home.dateCard.days', { count: toGo })}
              </AppText>
            </View>
            <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
              {(mainEvent
                ? t('planner.hero.until', {
                    event: localized(mainEvent.name),
                    date: shortDay(target!),
                  })
                : shortDay(target!)
              ).toUpperCase()}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="title" weight={800} color="onHero" style={styles.upper}>
              {left?.kind === 'today'
                ? t('planner.today')
                : left?.kind === 'over'
                  ? t('home.dateCard.married')
                  : t('planner.hero.ask')}
            </AppText>
            {!left && (
              <AppText color="onHero2" style={styles.kicker} maxFontSizeMultiplier={1.4}>
                {t('planner.hero.askKicker').toUpperCase()}
              </AppText>
            )}
          </>
        )}
      </PressableScale>

      <View style={styles.actions}>
        {canEdit && (
          <HeroPill
            icon="calendar-outline"
            label={all.length > 0 ? t('planner.hero.days') : t('planner.hero.pickDays')}
            onPress={openDays}
          />
        )}
        {canEdit && !title && (
          <HeroPill
            icon="create-outline"
            label={t('planner.addNames')}
            onPress={() => router.push('/guest-details')}
          />
        )}
      </View>
      <View style={[styles.rounded, { backgroundColor: Colors.bg }]} />
    </View>
  );
}

/** A see-through white capsule on the ombre. */
function HeroPill({
  icon,
  label,
  onPress,
}: {
  icon: 'calendar-outline' | 'create-outline';
  label: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Icon name={icon} size={18} color={Colors.onHero} weight="semibold" />
      <AppText variant="label" weight={600} color="onHero">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Everyone planning, as overlapping circles with their initials; a tap opens Family. */
function Faces({ weddingId, onPress }: { weddingId: string; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('label'), 1.3);
  const members = useWeddingMembers(weddingId);
  const people = members.data ?? [];
  if (people.length === 0) return null;
  const { faces, more } = faceList(people);
  const size = Math.round(40 * scale);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.planningCount', { count: people.length })}
      accessibilityHint={t('planner.familyHint')}
      hitSlop={8}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.faces, pressed && styles.facesPressed]}
    >
      {[...faces.map((face: Face) => face.letters), ...(more > 0 ? [`+${more}`] : [])].map(
        (letters, index) => (
          <View
            key={`${letters}-${index}`}
            style={[styles.face, { width: size, height: size }, index > 0 && styles.overlap]}
          >
            <AppText variant="label" weight={700} color="onHero" maxFontSizeMultiplier={1.3}>
              {letters}
            </AppText>
          </View>
        ),
      )}
    </Pressable>
  );
}

const ROUND = 32;

/** How tall the top is on a screen this tall: about a third, never under 300. */
export function heroHeight(screen: number): number {
  return Math.max(300, Math.round(screen * 0.36));
}

const useStyles = makeStyles((Colors) => ({
  hero: {
    justifyContent: 'flex-end',
    gap: Spacing.xl,
    marginHorizontal: -Sizes.pageGutter,
    paddingHorizontal: Sizes.pageGutter + Spacing.xs,
    paddingBottom: ROUND + Spacing.md,
    backgroundColor: Colors.ombreBase,
  },
  clip: {
    overflow: 'hidden',
  },
  above: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -800,
    height: 800,
    backgroundColor: Colors.ombreBase,
  },
  // The page's white rises over the ombre's bottom in a soft curve
  rounded: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: ROUND,
    borderTopLeftRadius: ROUND,
    borderTopRightRadius: ROUND,
    borderCurve: 'continuous',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
    gap: Spacing.xs,
  },
  kicker: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.4,
  },
  count: {
    gap: Spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  number: {
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  upper: {
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: Colors.onHeroFill,
  },
  pillPressed: {
    backgroundColor: Colors.onHeroFillPressed,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  facesPressed: {
    opacity: 0.7,
  },
  face: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.onHero,
    backgroundColor: Colors.onHeroFill,
  },
  overlap: {
    marginLeft: -12,
  },
}));
