import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { CategoryRow } from '@/components/category-row';
import { groupIcon } from '@/components/group-icon';
import { IconLine } from '@/components/icon-line';
import { ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useEvent, useEventNeeds } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

// Headings for event_categories.importance; anything new shows without one.
const IMPORTANCE_HEADINGS: Partial<Record<string, string>> = {
  essential: 'event.essential',
  nice_to_have: 'event.niceToHave',
};

/** S5 Event page: what the event is and the vendors it needs. Deep link: /e/{slug}. */
export default function EventScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const event = useEvent(slug);
  const needs = useEventNeeds(slug);
  const title = event.data ? localized(event.data.name) : null;

  const retry = () => {
    void event.refetch();
    void needs.refetch();
  };

  let body;
  if (event.isPending || needs.isPending) {
    body = <StateView state="loading" />;
  } else if (event.isError || needs.isError) {
    body = <StateView state="error" onRetry={retry} />;
  } else if (!event.data) {
    body = (
      <StateView
        state="empty"
        icon="calendar-outline"
        message={t('event.notFound')}
        action={{ label: t('common.goHome'), onPress: () => router.navigate('/') }}
      />
    );
  } else {
    body = (
      <>
        {(event.data.timing || event.data.summary) && (
          <View style={styles.about}>
            {event.data.timing && (
              <IconLine icon="time-outline" color="text2">
                {localized(event.data.timing)}
              </IconLine>
            )}
            {event.data.summary && (
              <AppText variant="bodyLg">{localized(event.data.summary)}</AppText>
            )}
          </View>
        )}

        <View style={styles.needs}>
          <SectionTitle>{t('event.needsTitle')}</SectionTitle>
          {needs.data.map((section) => {
            const heading = IMPORTANCE_HEADINGS[section.importance];
            return (
              <ListSection key={section.importance} header={heading ? t(heading) : undefined} inset>
                {section.needs.map((need) => (
                  <CategoryRow
                    key={need.categorySlug}
                    name={need.name}
                    icon={groupIcon(need.groupSlug)}
                    onPress={() =>
                      router.push({
                        pathname: '/c/[category]',
                        params: { category: need.categorySlug, event: slug },
                      })
                    }
                  />
                ))}
              </ListSection>
            );
          })}
        </View>
      </>
    );
  }

  return <NavScreen title={title}>{body}</NavScreen>;
}

const styles = StyleSheet.create({
  about: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  needs: {
    gap: Spacing.lg,
  },
});
