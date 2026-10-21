import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { GuestBand } from '@/data/inquiries';
import { GUEST_BANDS } from '@/features/inquiry/inquiry-helpers';
import { localized, type LocalizedText } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { formatDate } from './inquiry-helpers';

const DOT = 26;

type Props = {
  events: { slug: string; name: LocalizedText }[];
  selected: string[];
  /** Each event's day from My Wedding, by slug. */
  dates?: Record<string, string>;
  /** Each event's guest band from My Wedding, by slug. */
  guests?: Record<string, string>;
  onToggle: (slug: string) => void;
};

/**
 * The family's events as a numbered timeline, in ceremony order, each with
 * its day and guest count from My Wedding when they've been set. Tapping a
 * row picks that event for the ask; a picked one fills its number in with a
 * tick, so colour is never the only signal.
 */
export function EventTimeline({ events, selected, dates, guests, onToggle }: Props) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View>
      {events.map((event, index) => {
        const on = selected.includes(event.slug);
        const band = guests?.[event.slug];
        const day = dates?.[event.slug];
        const facts = [
          day ? formatDate(day) : null,
          GUEST_BANDS.includes(band as GuestBand) ? t(`inquiry.guestBands.${band}`) : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const last = index === events.length - 1;
        return (
          <Pressable
            key={event.slug}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={[localized(event.name), facts].filter(Boolean).join(', ')}
            onPress={() => {
              selectionHaptic();
              onToggle(event.slug);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, on && styles.dotOn]}>
                {on ? (
                  <Icon name="checkmark" size={15} color={Colors.onPrimary} weight="bold" />
                ) : (
                  <AppText variant="caption" weight={700} maxFontSizeMultiplier={1.2}>
                    {String(index + 1)}
                  </AppText>
                )}
              </View>
              {!last && <View style={styles.line} />}
            </View>
            <View style={[styles.words, !last && styles.wordsGap]}>
              <AppText weight={on ? 700 : 500}>{localized(event.name)}</AppText>
              {facts ? (
                <AppText variant="label" color="text2">
                  {facts}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: Sizes.tapTarget,
  },
  pressed: {
    opacity: 0.6,
  },
  rail: {
    width: DOT,
    alignItems: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  dotOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  line: {
    flex: 1,
    width: 0,
    marginVertical: 3,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  words: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  wordsGap: {
    paddingBottom: Spacing.lg,
  },
}));
