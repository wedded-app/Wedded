import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { MAX_VISIT_DAYS, toggleVisitDay } from '@/features/inquiry/ask-draft';
import { shortDay } from '@/features/inquiry/ask-message';
import { fromDateString, toDateString } from '@/features/inquiry/inquiry-helpers';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/** How far ahead the day tiles go. */
const DAYS_AHEAD = 14;

/**
 * "Visit the hall" on a venue's page (Fezy found a plain row "too hidden",
 * 2026-11-11): the next two weeks as day tiles, up to three picked, and an
 * outlined Ask to visit, which opens Ask for a quote as a visit with those
 * days filled in. The hall confirms one, with a time.
 */
export function VisitSection({ vendorId, event }: { vendorId: string; event?: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLocale();
  const [picked, setPicked] = useState<string[]>([]);
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return toDateString(date);
  });
  const label =
    picked.length === 0
      ? t('vendor.visit.pick')
      : picked.length === 1
        ? t('vendor.visit.one', { day: shortDay(picked[0]) })
        : t('vendor.visit.many', { number: picked.length });

  return (
    <View style={styles.block}>
      <View style={styles.words}>
        <AppText variant="section" accessibilityRole="header">
          {t('vendor.visit.title')}
        </AppText>
        <AppText color="text2">{t('vendor.visit.body', { number: MAX_VISIT_DAYS })}</AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {days.map((day) => {
          const on = picked.includes(day);
          const full = !on && picked.length >= MAX_VISIT_DAYS;
          const date = fromDateString(day);
          const tone = on ? 'onPrimary' : full ? 'textDisabled' : 'text';
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: full }}
              accessibilityLabel={date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              onPress={() => {
                if (full) return;
                selectionHaptic();
                setPicked(toggleVisitDay(picked, day));
              }}
              style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && styles.pressed]}
            >
              <AppText variant="caption" weight={600} color={tone} style={styles.caps}>
                {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
              </AppText>
              <AppText weight={700} color={tone} style={styles.number}>
                {String(date.getDate())}
              </AppText>
              <AppText variant="caption" weight={600} color={tone} style={styles.caps}>
                {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: picked.length === 0 }}
        disabled={picked.length === 0}
        onPress={() => {
          selectionHaptic();
          router.push({
            pathname: '/ask',
            params: {
              vendorId,
              kind: 'tour',
              visit: picked.join(','),
              ...(event ? { event } : {}),
            },
          });
        }}
        style={[styles.ask, picked.length === 0 && styles.askOff]}
      >
        <Icon
          name="calendar-outline"
          size={19}
          color={picked.length === 0 ? Colors.textDisabled : Colors.text}
        />
        <AppText weight={700} color={picked.length === 0 ? 'textDisabled' : 'text'}>
          {label}
        </AppText>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.lg,
  },
  words: {
    gap: Spacing.xs,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  row: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: 2,
  },
  day: {
    width: 66,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  pressed: {
    opacity: 0.7,
  },
  caps: {
    letterSpacing: 0.6,
  },
  number: {
    fontSize: 24,
    lineHeight: 28,
  },
  ask: {
    minHeight: Sizes.button + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  askOff: {
    borderColor: Colors.border,
  },
}));
