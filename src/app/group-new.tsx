import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { groupErrorKind, useCreateGroupThread } from '@/data/group-chat';
import { useWeddingMembers } from '@/data/wedding';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

/**
 * Start a family chat in a wedding (A2, #125): a name and who from the
 * wedding plan is in it. Friends join later with a link from Chat info.
 * /group-new?wedding={wedding id}
 */
export default function NewGroupScreen() {
  const { t } = useLocale();
  const { wedding = '' } = useLocalSearchParams<{ wedding: string }>();
  const members = useWeddingMembers(wedding || null);
  const create = useCreateGroupThread();
  const [name, setName] = useState(t('groupChat.new.defaultName'));
  // Everyone in the plan to start with; untick who shouldn't be in it
  const [left, setLeft] = useState<Set<string>>(new Set());
  const close = () => router.canGoBack() && router.back();

  const others = (members.data ?? []).filter((m) => !m.isMe);
  const toggle = (userId: string) => {
    selectionHaptic();
    setLeft((all) => {
      const next = new Set(all);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const start = () =>
    create.mutate(
      {
        weddingId: wedding,
        name: name.trim(),
        memberIds: others.filter((m) => !left.has(m.userId)).map((m) => m.userId),
      },
      {
        onSuccess: (id) => {
          successHaptic();
          router.replace({ pathname: '/group/[id]', params: { id } });
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} title={t('groupChat.new.title')} />
      {members.isPending ? (
        <StateView state="loading" />
      ) : members.isError ? (
        <StateView state="error" onRetry={() => void members.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextField
            label={t('groupChat.new.name')}
            hint={t('groupChat.new.nameHint')}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          {others.length > 0 && (
            <ListSection header={t('groupChat.new.who')} footer={t('groupChat.new.whoHint')}>
              {others.map((member) => (
                <ListRow
                  key={member.userId}
                  title={member.name ?? t('groupChat.formerMember')}
                  checked={!left.has(member.userId)}
                  onPress={() => toggle(member.userId)}
                />
              ))}
            </ListSection>
          )}
          {others.length === 0 && <AppText color="text2">{t('groupChat.new.whoHint')}</AppText>}
          {create.isError && (
            <FieldError message={t(`groupChat.errors.${groupErrorKind(create.error)}`)} />
          )}
          <Button
            icon="chatbubbles-outline"
            label={t('groupChat.new.create')}
            disabled={!name.trim()}
            loading={create.isPending}
            onPress={start}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
