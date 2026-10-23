import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { makeStyles, Spacing } from '@/constants/theme';
import { useWeddingMembers } from '@/data/wedding';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

import type { usePlanView } from './use-plan-view';
import {
  countdown,
  countdownText,
  daysLine,
  eventsLine,
  faceList,
  weddingDays,
  type Face,
} from './wedding-tab';

type PlanView = ReturnType<typeof usePlanView>;

const FACE = 40;

/**
 * The two of you, at the top of the Wedding tab (the final look,
 * 2026-10-23): the couple's names as guests see them, the wedding's days
 * from first to last with the days to go, a calm line about the events
 * instead of a booked count, and the faces of everyone planning, which open
 * Family further down. Before there's a date it asks for one.
 */
export function WeddingTop({ view, onFamily }: { view: PlanView; onFamily: () => void }) {
  const styles = useStyles();
  const { t } = useLocale();
  const { plan, wedding, canEdit, chosen, progress } = view;
  const title = wedding?.title?.trim() || null;
  const days = weddingDays(
    plan.weddingDate,
    plan.eventDates,
    chosen.map((event) => event.slug),
  );
  const span = daysLine(days);
  const left = countdown(days, plan.weddingDate);
  const calm = eventsLine(
    chosen.length,
    chosen[0] ? localized(chosen[0].name) : null,
    progress.total > 0 && progress.done === progress.total,
    t,
  );

  return (
    <View style={styles.top}>
      <View style={styles.nameRow}>
        <View style={styles.grow}>
          {title && (
            <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
              {t('planner.yourWedding').toUpperCase()}
            </AppText>
          )}
          <Names title={title ?? t('planner.yourWedding')} />
        </View>
        {wedding && <Faces weddingId={wedding.id} onPress={onFamily} />}
      </View>

      {span && left ? (
        <>
          <AppText variant="label" weight={600} color="text2" style={styles.caps}>
            {left.kind === 'toGo' ? `${span} · ${countdownText(left, t).toUpperCase()}` : span}
          </AppText>
          {left.kind !== 'toGo' && (
            <AppText variant="heading" weight={600} color="primary">
              {countdownText(left, t)}
            </AppText>
          )}
        </>
      ) : (
        <View style={styles.ask}>
          <AppText variant="heading" weight={600}>
            {t('planner.whenTitle')}
          </AppText>
          <AppText color="text2">{t('planner.whenBody')}</AppText>
        </View>
      )}
      {calm && (
        <AppText variant="label" weight={400} color="text2">
          {calm}
        </AppText>
      )}

      {canEdit && (
        <View style={styles.edit}>
          <DateField
            value={plan.weddingDate}
            onChange={(date) => {
              successHaptic();
              view.setWeddingDate(date);
            }}
            placeholder={plan.weddingDate ? t('planner.changeDate') : t('planner.pickDate')}
          />
          {!title && (
            <Button
              variant="text"
              icon="create-outline"
              label={t('planner.addNames')}
              onPress={() => router.push('/guest-details')}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** The names, with the "&" between them in maroon: "Simran & Arjun". */
function Names({ title }: { title: string }) {
  const parts = title.split('&');
  return (
    <AppText variant="display" accessibilityRole="header">
      {parts.flatMap((part, index) =>
        index === 0
          ? [part]
          : [
              <AppText key={index} variant="display" color="primary">
                &amp;
              </AppText>,
              part,
            ],
      )}
    </AppText>
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
  const size = Math.round(FACE * scale);

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
      style={({ pressed }) => [styles.faces, pressed && styles.pressed]}
    >
      {faces.map((face, index) => (
        <FaceCircle key={face.key} face={face} size={size} first={index === 0} />
      ))}
      {more > 0 && (
        <View style={[styles.face, styles.more, { width: size, height: size }]}>
          <AppText variant="label" weight={700} maxFontSizeMultiplier={1.3}>
            {`+${more}`}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function FaceCircle({ face, size, first }: { face: Face; size: number; first: boolean }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.face,
        face.isMe ? styles.faceMe : styles.faceOther,
        { width: size, height: size },
        !first && styles.overlap,
      ]}
    >
      <AppText
        variant="label"
        weight={700}
        color={face.isMe ? 'onPrimary' : 'primary'}
        maxFontSizeMultiplier={1.3}
      >
        {face.letters}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  top: {
    gap: Spacing.sm,
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
  caps: {
    letterSpacing: 0.6,
  },
  ask: {
    gap: Spacing.xs,
  },
  edit: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  face: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  faceMe: {
    backgroundColor: Colors.primaryFill,
  },
  faceOther: {
    backgroundColor: Colors.primaryTint,
  },
  more: {
    marginLeft: -12,
    backgroundColor: Colors.surface2,
  },
  overlap: {
    marginLeft: -12,
  },
}));
