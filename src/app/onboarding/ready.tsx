import { router } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { eventIcon } from '@/components/event-icon';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { resetAnswers } from '@/features/onboarding/answers';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { CountdownCard } from '@/features/planner/countdown-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

const RIBBON = require('../../../assets/images/ribbon.png');

/**
 * The end of the first questions, the payoff (like Calm's "recommended for
 * you"): the knot, their countdown, the events we started them with (change
 * them any time) and the first things to book, then into the app.
 */
export default function ReadyScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { plan, chosen, progress, next } = usePlanView();

  return (
    <Screen edges={['top', 'bottom']} plain>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={Motion.popIn} style={styles.knot}>
          <Image source={RIBBON} style={styles.ribbon} resizeMode="contain" accessible={false} />
        </Animated.View>
        <Animated.View entering={Motion.rise} style={styles.intro}>
          <AppText
            variant="display"
            weight={800}
            accessibilityRole="header"
            style={[styles.center, styles.title]}
          >
            {t('onboarding.ready.title')}
          </AppText>
          <AppText variant="bodyLg" color="text2" style={styles.center}>
            {chosen.length > 0
              ? t('onboarding.ready.subtitle', { count: chosen.length })
              : t('onboarding.ready.subtitleNoEvents')}
          </AppText>
        </Animated.View>

        <Animated.View entering={Motion.stagger(1)}>
          <CountdownCard plan={plan} progress={progress} eventsCount={chosen.length} />
        </Animated.View>

        {chosen.length > 0 && (
          <Animated.View entering={Motion.stagger(2)} style={styles.block}>
            <AppText variant="label" weight={600} color="text2" style={styles.pad}>
              {t('onboarding.ready.events')}
            </AppText>
            <View style={styles.events}>
              {chosen.map((event) => (
                <View key={event.slug} style={styles.event}>
                  <Icon name={eventIcon(event.slug)} size={16} color={Colors.text} />
                  <AppText variant="label" weight={600}>
                    {localized(event.name, locale)}
                  </AppText>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {next.length > 0 && (
          <Animated.View entering={Motion.stagger(3)} style={styles.block}>
            <AppText variant="label" weight={600} color="text2" style={styles.pad}>
              {t('onboarding.ready.firstUp')}
            </AppText>
            <View style={styles.card}>
              {next.map(({ eventSlug, eventName, need }, index) => (
                <View
                  key={`${eventSlug}:${need.categorySlug}`}
                  style={[styles.row, index > 0 && styles.divided]}
                >
                  <View style={styles.rowIcon}>
                    <Icon name={groupIcon(need.groupSlug)} size={20} color={Colors.text} />
                  </View>
                  <View style={styles.grow}>
                    <AppText weight={600}>{localized(need.name, locale)}</AppText>
                    <AppText variant="caption" color="text2">
                      {localized(eventName, locale)}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={t('onboarding.ready.go')}
          onPress={() => {
            resetAnswers();
            // My Wedding, as the button says; its Back leads Home.
            router.replace('/plan');
          }}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  knot: {
    alignSelf: 'center',
  },
  ribbon: {
    width: 96,
    height: 81,
  },
  intro: {
    gap: Spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  title: {
    letterSpacing: -0.5,
  },
  block: {
    gap: Spacing.sm,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
  },
  events: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  event: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radius.chip,
    backgroundColor: Colors.canvasCard,
  },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
    overflow: 'hidden',
  },
  row: {
    minHeight: Sizes.row + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  grow: {
    flex: 1,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
}));
