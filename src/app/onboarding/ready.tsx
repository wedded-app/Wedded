import { router } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useVendorSearch } from '@/data/search';
import { useSearchLocation } from '@/features/location/search-location';
import { resetAnswers } from '@/features/onboarding/answers';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { CountdownCard } from '@/features/planner/countdown-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

const RIBBON = require('../../../assets/images/ribbon.png');

/** Vendors counted near them; more shows as "100+". */
const COUNTED = 100;

/**
 * The end of the first questions, the payoff (like Calm's "recommended for
 * you"): the knot, their countdown, and how Wedded helps from here, in their
 * own numbers: their events and the first thing to book, the vendors near
 * them, and planning with family. Then into the app.
 */
export default function ReadyScreen() {
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { plan, chosen, progress, next } = usePlanView();
  const { place, maxMiles } = useSearchLocation();
  const nearby = useVendorSearch(
    { latitude: place?.latitude, longitude: place?.longitude, maxMiles, limit: COUNTED },
    { enabled: !!place },
  );

  const first = next[0];
  const vendors = nearby.data?.length ?? 0;

  return (
    <Screen edges={['top', 'bottom']} plain>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={Motion.popIn} style={styles.knot}>
          <Image source={RIBBON} style={styles.ribbon} resizeMode="contain" accessible={false} />
        </Animated.View>
        <Animated.View entering={Motion.rise} style={styles.intro}>
          <AppText
            variant="display"
            weight={600}
            serif
            accessibilityRole="header"
            style={[styles.center, styles.title]}
          >
            {t('onboarding.ready.title')}
          </AppText>
          <AppText variant="bodyLg" color="text2" style={styles.center}>
            {t('onboarding.ready.subtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={Motion.stagger(1)}>
          <CountdownCard plan={plan} progress={progress} eventsCount={chosen.length} />
        </Animated.View>

        <Animated.View entering={Motion.stagger(2)} style={styles.card}>
          <HelpRow
            icon="checkbox-outline"
            title={
              chosen.length > 0
                ? t('onboarding.ready.events', { count: chosen.length })
                : t('onboarding.ready.noEvents')
            }
            detail={
              first
                ? t('onboarding.ready.firstUp', {
                    need: localized(first.need.name, locale),
                    event: localized(first.eventName, locale),
                  })
                : t('onboarding.ready.noEventsDetail')
            }
          />
          <HelpRow
            divided
            icon="storefront-outline"
            title={
              place && vendors >= COUNTED
                ? t('onboarding.ready.vendorsNearMany', { count: COUNTED, city: place.label })
                : place && vendors > 0
                  ? t('onboarding.ready.vendorsNear', { count: vendors, city: place.label })
                  : t('onboarding.ready.vendors')
            }
            detail={t('onboarding.ready.vendorsDetail')}
          />
          <HelpRow
            divided
            icon="people-outline"
            title={t('onboarding.ready.together')}
            detail={t('onboarding.ready.togetherDetail')}
          />
        </Animated.View>
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

/** One thing Wedded does for them: an icon in a white circle, a bold line and a plain one. */
function HelpRow({
  icon,
  title,
  detail,
  divided = false,
}: {
  icon: IconName;
  title: string;
  detail: string;
  divided?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.row, divided && styles.divided]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.grow}>
        <AppText weight={600}>{title}</AppText>
        <AppText variant="label" weight={400} color="text2">
          {detail}
        </AppText>
      </View>
    </View>
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
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
    overflow: 'hidden',
  },
  row: {
    minHeight: Sizes.row + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
    borderTopColor: Colors.canvas,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
}));
