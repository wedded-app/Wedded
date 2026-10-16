import { useLocalSearchParams, useRouter } from 'expo-router';

import { CategoryRow } from '@/components/category-row';
import { groupIcon } from '@/components/group-icon';
import { ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { useCategoryGroups } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * One group of vendor types (Venues, Music...) and the types in it; each opens
 * the vendor list for that type. Deep link: /g/{group}.
 */
export default function GroupScreen() {
  const { group: groupSlug = '' } = useLocalSearchParams<{ group: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const groups = useCategoryGroups();
  const group = groups.data?.find((g) => g.slug === groupSlug);
  const title = group ? localized(group.name) : null;

  let body;
  if (groups.isPending) {
    body = <StateView state="loading" />;
  } else if (groups.isError) {
    body = <StateView state="error" onRetry={() => void groups.refetch()} />;
  } else if (!group) {
    body = (
      <StateView
        state="empty"
        icon="grid-outline"
        message={t('group.notFound')}
        action={{ label: t('common.goHome'), onPress: () => router.navigate('/') }}
      />
    );
  } else {
    body = (
      <ListSection inset>
        {group.categories.map((category) => (
          <CategoryRow
            key={category.slug}
            name={category.name}
            icon={groupIcon(group.slug)}
            onPress={() =>
              router.push({ pathname: '/c/[category]', params: { category: category.slug } })
            }
          />
        ))}
      </ListSection>
    );
  }

  return <NavScreen title={title}>{body}</NavScreen>;
}
