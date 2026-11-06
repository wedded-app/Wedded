import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { CheckCircle } from '@/components/check-circle';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Spacing, useColors } from '@/constants/theme';
import type { EventNeed } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

import { findForPlan } from './find-for-plan';

/**
 * One kind of vendor an event needs, as a tile on its page: the kind's icon
 * and a tick in the corner (filled once it's booked), its name, and below,
 * who's booked, how many suggestions wait, or Find. Tapping the tile finds
 * one near them for this event; tapping the tick marks it booked.
 */
export function NeedTile({
  need,
  eventSlug,
  booked,
  bookedWith,
  suggested,
  guests,
  canEdit,
  onToggle,
  style,
}: {
  need: EventNeed;
  eventSlug: string;
  booked: boolean;
  /** The vendor's name, when the booking names one. */
  bookedWith: string | null;
  /** Open suggestions for it, waiting for the family to decide. */
  suggested: number;
  /** The event's guest band, which Find turns into filters. */
  guests: string | null;
  canEdit: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const name = localized(need.name);

  let status: string;
  let tone: 'success' | 'primary' = 'primary';
  if (booked) {
    status = bookedWith ? t('planner.bookedWith', { name: bookedWith }) : t('planner.event.booked');
    tone = 'success';
  } else if (suggested > 0) {
    status = t('suggestions.openCount', { count: suggested });
  } else {
    status = t('planner.findShort');
  }

  return (
    <Animated.View layout={Motion.layout} style={style}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${name}, ${status}`}
        accessibilityHint={t('planner.find', { name })}
        pressedScale={0.97}
        onPress={() => {
          selectionHaptic();
          findForPlan(need.categorySlug, need.groupSlug, eventSlug, guests);
        }}
        style={[styles.tile, booked && styles.tileBooked]}
      >
        <View style={styles.top}>
          <View style={[styles.icon, booked && styles.iconBooked]}>
            <Icon
              name={groupIcon(need.groupSlug)}
              size={22}
              color={booked ? Colors.success : Colors.primary}
            />
          </View>
          {canEdit && (
            <CheckCircle
              checked={booked}
              accessibilityLabel={t('planner.markBooked', { name })}
              onPress={() => {
                if (booked) selectionHaptic();
                else successHaptic();
                onToggle();
              }}
            />
          )}
        </View>
        <View style={styles.words}>
          <AppText weight={600} numberOfLines={2}>
            {name}
          </AppText>
          <View style={styles.status}>
            <AppText
              variant="label"
              weight={600}
              color={tone}
              numberOfLines={1}
              style={styles.grow}
            >
              {status}
            </AppText>
            {!booked && suggested === 0 && (
              <Icon name="arrow-forward" size={15} color={Colors.primary} weight="semibold" />
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  tile: {
    flexGrow: 1,
    minHeight: 136,
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  tileBooked: {
    backgroundColor: Colors.successTint,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  iconBooked: {
    backgroundColor: Colors.bg,
  },
  words: {
    gap: 2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  grow: {
    flexShrink: 1,
  },
}));
