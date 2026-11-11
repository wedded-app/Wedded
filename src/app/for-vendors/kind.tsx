import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { LineField } from '@/components/line-field';
import { StateView } from '@/components/state-view';
import { useCategories, useCategoryGroups } from '@/data/reference';
import { OptionRow } from '@/features/onboarding/option-row';
import { KIND_PHOTOS } from '@/features/search/kind-photos';
import { kindOptions, setJoinDraft, useJoinDraft } from '@/features/vendor-join/join-draft';
import { JoinQuestion } from '@/features/vendor-join/join-question';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Spacing } from '@/constants/theme';

/**
 * List your business, question 2: what they do, from the database's kinds
 * of vendor, each with its round photo as on the Vendors tab. Every kind
 * shows until they type; then only the ones that match.
 */
export default function KindStep() {
  const { t } = useLocale();
  const draft = useJoinDraft();
  const categories = useCategories();
  const groups = useCategoryGroups();
  const loading = categories.isPending || groups.isPending;
  const failed = categories.isError || groups.isError;
  const options = kindOptions(groups.data ?? [], categories.data ?? [], draft.kindQuery);

  return (
    <JoinQuestion
      step="kind"
      title={t('vendorJoin.kind.title')}
      subtitle={t('vendorJoin.kind.subtitle')}
      canContinue={!!draft.categorySlug}
      onContinue={() => router.push('/for-vendors/town')}
    >
      <LineField
        size="medium"
        label={t('vendorJoin.kind.searchLabel')}
        placeholder={t('vendorJoin.kind.search')}
        value={draft.kindQuery}
        onChangeText={(kindQuery) => setJoinDraft({ kindQuery })}
        autoCorrect={false}
        returnKeyType="search"
        maxLength={60}
      />
      {loading && <StateView state="loading" />}
      {failed && (
        <StateView
          state="error"
          onRetry={() => {
            void categories.refetch();
            void groups.refetch();
          }}
        />
      )}
      {!loading && !failed && options.length === 0 && (
        <AppText color="text2" style={styles.note}>
          {t('signIn.business.typeNoMatch')}
        </AppText>
      )}
      {!loading && !failed && options.length > 0 && (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('vendorJoin.kind.title')}>
          {options.map((kind, index) => (
            <OptionRow
              key={kind.slug}
              index={index}
              label={localized(kind.name)}
              image={KIND_PHOTOS[kind.slug] ?? null}
              icon={groupIcon(kind.groupSlug)}
              selected={draft.categorySlug === kind.slug}
              onPress={() => setJoinDraft({ categorySlug: kind.slug })}
            />
          ))}
        </View>
      )}
    </JoinQuestion>
  );
}

const styles = StyleSheet.create({
  // In line with the words in the field above
  note: {
    paddingHorizontal: Spacing.xs,
  },
});
