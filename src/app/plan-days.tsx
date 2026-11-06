import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import { DayList } from '@/features/planner/day-list';
import { usePlanDays } from '@/features/planner/use-plan-days';
import { usePlanView } from '@/features/planner/use-plan-view';
import { useLocale } from '@/i18n/locale-context';

/**
 * Your days, a sheet from the top of the Wedding tab: every event with its
 * day, as in the first questions. A tap picks an event's day on the
 * calendar, and the link between two puts them on one day. The wedding
 * date follows the main day.
 */
export default function PlanDaysScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const view = usePlanView();
  const days = usePlanDays(view);
  const close = () => router.canGoBack() && router.back();

  let content;
  if (view.isError) content = <StateView state="error" onRetry={() => void view.refetch()} />;
  else if (view.isPending || view.loading) content = <StateView state="loading" />;
  else if (days.events.length === 0) {
    content = (
      <StateView
        state="empty"
        icon="calendar-outline"
        message={t('planner.daysSheet.empty')}
        action={{ label: t('planner.chooseEvents'), onPress: () => router.replace('/plan-events') }}
      />
    );
  } else {
    content = (
      <DayList
        events={days.listed}
        state={days.state}
        onChange={days.change}
        editable={view.canEdit}
      />
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('planner.hero.days')}
          </AppText>
          <AppText color="text2">{t('onboarding.days.subtitle')}</AppText>
        </View>
        {content}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t('planner.picker.done')} onPress={close} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
}));
