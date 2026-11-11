import { router } from 'expo-router';

import { LineField } from '@/components/line-field';
import { setJoinDraft, useJoinDraft } from '@/features/vendor-join/join-draft';
import { JoinQuestion } from '@/features/vendor-join/join-question';
import { useLocale } from '@/i18n/locale-context';

/** List your business, question 1: the business's name, as families will see it. */
export default function NameStep() {
  const { t } = useLocale();
  const draft = useJoinDraft();
  const ready = draft.name.trim().length >= 2;
  const next = () => router.push('/for-vendors/kind');

  return (
    <JoinQuestion
      step="name"
      title={t('vendorJoin.name.title')}
      subtitle={t('vendorJoin.name.subtitle')}
      canContinue={ready}
      onContinue={next}
    >
      <LineField
        label={t('vendorJoin.name.label')}
        placeholder={t('vendorJoin.name.label')}
        value={draft.name}
        onChangeText={(name) => setJoinDraft({ name })}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        maxLength={80}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => ready && next()}
      />
    </JoinQuestion>
  );
}
