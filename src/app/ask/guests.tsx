import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { setAsk } from '@/features/inquiry/ask-draft';
import { AskScreen } from '@/features/inquiry/ask-screen';
import { AskStep } from '@/features/inquiry/ask-step';
import { GuestPicker } from '@/features/inquiry/guest-picker';
import { useAsk } from '@/features/inquiry/use-ask';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Ask for a quote, page 3 of 5: about how many guests. It starts from their
 * plan, and a hall's seats are marked on the slider so they see whether
 * they fit. "Not sure yet" sits beside the arrow.
 */
export default function AskGuestsStep() {
  const ask = useAsk();
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { draft, v } = ask;
  const seats = v?.hall.seats;

  return (
    <AskScreen ask={ask}>
      <AskStep
        step={3}
        heading={ask.heading}
        photo={ask.photo}
        title={t('ask.guests.title')}
        subtitle={
          seats
            ? t('ask.guests.subtitleSeats', { vendor: ask.name, seats })
            : t('ask.guests.subtitle')
        }
        summary={
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.guestsUnsure }}
            hitSlop={8}
            onPress={() => {
              selectionHaptic();
              setAsk({ guestsUnsure: !draft.guestsUnsure });
            }}
            style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
          >
            <View style={[styles.box, draft.guestsUnsure && styles.boxOn]}>
              {draft.guestsUnsure && (
                <Icon name="checkmark" size={14} color={Colors.onPrimary} weight="bold" />
              )}
            </View>
            <AppText weight={600}>{t('ask.guests.unsure')}</AppText>
          </Pressable>
        }
        onContinue={() => router.push('/ask/details')}
      >
        <GuestPicker
          count={ask.count}
          unsure={draft.guestsUnsure}
          seats={seats}
          onChange={(count) => setAsk({ guestCount: count, guestsUnsure: false })}
        />
      </AskStep>
    </AskScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  unsure: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.separator,
  },
  boxOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
}));
