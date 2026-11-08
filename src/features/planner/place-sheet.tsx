import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { TextField } from '@/components/text-field';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { placeKind, placeToSave, type PlaceKind } from './place';

export type PlaceSheetProps = {
  /** The question, already in words: "Where's the Dholki?". Open while set. */
  title: string | null;
  /** The event's place and start time as saved ("19:30"). */
  place: string | null;
  time: string | null;
  /** A hall or gurdwara booked for this event, filled in when they pick Venue. */
  bookedVenue: string | null;
  onSave: (place: string | null, time: string | null) => void;
  onClose: () => void;
};

/**
 * Where one event is and when it starts, in a sheet from the bottom of its
 * page: Home or a venue as two big choices (many dholkis and mehndis are at
 * home), the venue's name when it's one, then the start time and Save.
 * Only this event: every event's details for the RSVP page stay on the
 * invitation details (/guest-details).
 */
export function PlaceSheet({ title, place, time, bookedVenue, onSave, onClose }: PlaceSheetProps) {
  // A fresh form each time it opens, from what's saved
  const open = title !== null;
  const [opened, setOpened] = useState({ open, count: 0 });
  if (open !== opened.open) setOpened({ open, count: opened.count + (open ? 1 : 0) });

  return (
    <BottomSheet title={title} onClose={onClose}>
      <PlaceForm
        key={opened.count}
        place={place}
        time={time}
        bookedVenue={bookedVenue}
        onSave={(newPlace, newTime) => {
          onSave(newPlace, newTime);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

function PlaceForm({
  place,
  time,
  bookedVenue,
  onSave,
}: Pick<PlaceSheetProps, 'place' | 'time' | 'bookedVenue' | 'onSave'>) {
  const styles = useStyles();
  const { t } = useLocale();
  const saved = placeKind(place);
  const [kind, setKind] = useState<PlaceKind | null>(saved);
  const [venue, setVenue] = useState(saved === 'venue' ? place!.trim() : (bookedVenue ?? ''));
  const [startsAt, setStartsAt] = useState(time);

  // Tapping the picked one again un-picks it
  const pick = (next: PlaceKind) => {
    selectionHaptic();
    setKind((current) => (current === next ? null : next));
  };

  return (
    <View style={styles.form}>
      <View style={styles.choices} accessibilityRole="radiogroup">
        <Choice
          icon="home-outline"
          label={t('planner.place.home')}
          selected={kind === 'home'}
          onPress={() => pick('home')}
        />
        <Choice
          icon="business-outline"
          label={t('planner.place.venue')}
          selected={kind === 'venue'}
          onPress={() => pick('venue')}
        />
      </View>

      {kind === 'venue' && (
        <Animated.View entering={Motion.rise}>
          <TextField
            label={t('planner.place.which')}
            placeholder={t('planner.place.whichPlaceholder')}
            value={venue}
            onChangeText={setVenue}
            maxLength={200}
            autoFocus={!venue}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </Animated.View>
      )}

      <View style={styles.time}>
        {/* In the look of the field's label above */}
        <AppText variant="label" weight={600} style={styles.label}>
          {t('planner.place.startsAt')}
        </AppText>
        <DateField
          mode="time"
          value={startsAt}
          onChange={setStartsAt}
          placeholder={t('planner.place.pickTime')}
        />
      </View>

      <Button
        label={t('planner.place.save')}
        onPress={() => {
          successHaptic();
          onSave(placeToSave(kind, venue), startsAt);
        }}
      />
    </View>
  );
}

/** One of the two places, as a big square to tap, with a tick once picked. */
function Choice({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      pressedScale={0.97}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <View style={styles.choiceTop}>
        <Icon name={icon} size={28} color={Colors.text} />
        {selected && (
          <Animated.View entering={Motion.popIn} style={styles.tick}>
            <Icon name="checkmark" size={14} color={Colors.onPrimary} weight="bold" />
          </Animated.View>
        )}
      </View>
      <AppText weight={600} numberOfLines={2}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  form: {
    gap: Spacing.lg,
  },
  choices: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  choice: {
    flex: 1,
    minHeight: 104,
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
  },
  choiceOn: {
    borderColor: Colors.text,
    backgroundColor: Colors.bg,
  },
  choiceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  time: {
    gap: Spacing.sm,
  },
  label: {
    paddingHorizontal: Spacing.xs,
  },
}));
