import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import {
  groupErrorKind,
  useAddGroupMembers,
  useCreateGroupInvite,
  useGroupMembers,
  useGroupThreads,
  useRemoveGroupMember,
  useRenameGroupThread,
} from '@/data/group-chat';
import { shareInvite, useWeddingMembers } from '@/data/wedding';
import { useLocale } from '@/i18n/locale-context';

/** Asks first on phones (an alert) and on the web (the browser's confirm). */
function confirm(title: string, body: string, yes: string, no: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(body)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

/**
 * Who's in a family chat (A2, #125). Everyone can leave. Owners and editors of
 * the wedding who are in it can invite with a link, add people from the
 * wedding plan, remove someone and rename it. /group-info?id={thread id}
 */
export default function GroupInfoScreen() {
  const { t } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const threads = useGroupThreads();
  const thread = threads.data?.find((th) => th.id === id) ?? null;
  const members = useGroupMembers(id);
  const canManage = thread?.canManage ?? false;
  const wedding = useWeddingMembers(canManage ? (thread?.weddingId ?? null) : null);
  const invite = useCreateGroupInvite();
  const add = useAddGroupMembers(id);
  const remove = useRemoveGroupMember(id);
  const rename = useRenameGroupThread(id);
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string>();

  if (threads.isPending || members.isPending) {
    return (
      <NavScreen title={t('groupChat.info.title')}>
        <StateView state="loading" />
      </NavScreen>
    );
  }
  if (!thread) {
    return (
      <NavScreen title={t('groupChat.info.title')}>
        <StateView state="empty" icon="chatbubbles-outline" message={t('groupChat.unavailable')} />
      </NavScreen>
    );
  }

  const inChat = new Set((members.data ?? []).map((m) => m.userId));
  const addable = (wedding.data ?? []).filter((m) => !inChat.has(m.userId));
  const failed = [invite, add, remove, rename].find((m) => m.isError);

  const share = () => {
    setNote(undefined);
    invite.mutate(id, {
      onSuccess: async (link) => {
        const result = await shareInvite(link, t, 'groupChat.info.inviteMessage');
        if (result === 'copied') setNote(t('groupChat.info.copied'));
      },
    });
  };

  const leave = (userId: string) =>
    confirm(
      t('groupChat.info.leaveTitle'),
      t('groupChat.info.leaveConfirm'),
      t('groupChat.info.leave'),
      t('groupChat.info.keep'),
      () => remove.mutate(userId, { onSuccess: () => router.replace('/messages') }),
    );

  const removeSomeone = (userId: string, who: string) =>
    confirm(
      t('groupChat.info.removeTitle'),
      t('groupChat.info.removeConfirm', { name: who }),
      t('groupChat.info.remove'),
      t('groupChat.info.keep'),
      () => remove.mutate(userId),
    );

  const draftName = name ?? thread.name;

  return (
    <NavScreen title={t('groupChat.info.title')}>
      {canManage && (
        <View style={{ gap: Spacing.sm }}>
          <TextField
            label={t('groupChat.info.rename')}
            value={draftName}
            onChangeText={setName}
            maxLength={60}
          />
          {name !== null && name.trim() !== thread.name && (
            <Button
              variant="secondary"
              label={t('groupChat.info.save')}
              loading={rename.isPending}
              disabled={!name.trim()}
              onPress={() => rename.mutate(name.trim(), { onSuccess: () => setName(null) })}
            />
          )}
        </View>
      )}

      <ListSection header={t('groupChat.info.members')}>
        {(members.data ?? []).map((member) => {
          const who = member.name ?? t('groupChat.formerMember');
          return (
            <ListRow
              key={member.userId}
              icon="person-outline"
              title={member.isMe ? `${who} (${t('groupChat.you')})` : who}
              subtitle={[
                member.weddingRole ? t('groupChat.info.inWedding') : t('groupChat.info.friend'),
                member.canManage ? t('groupChat.info.manages') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                canManage && !member.isMe ? (
                  <Button
                    variant="text"
                    label={t('groupChat.info.remove')}
                    onPress={() => removeSomeone(member.userId, who)}
                  />
                ) : undefined
              }
            />
          );
        })}
      </ListSection>

      {canManage && (
        <ListSection footer={t('groupChat.info.inviteBody')}>
          <ListRow
            icon="link-outline"
            tone="primary"
            title={t('groupChat.info.invite')}
            onPress={share}
          />
        </ListSection>
      )}
      {note && <AppText color="text2">{note}</AppText>}

      {canManage && addable.length > 0 && (
        <ListSection header={t('groupChat.info.add')}>
          {addable.map((member) => (
            <ListRow
              key={member.userId}
              icon="person-add-outline"
              title={member.name ?? t('groupChat.formerMember')}
              trailing={
                <Button
                  variant="text"
                  label={t('groupChat.info.addOne')}
                  onPress={() => add.mutate([member.userId])}
                />
              }
            />
          ))}
        </ListSection>
      )}

      {failed && <FieldError message={t(`groupChat.errors.${groupErrorKind(failed.error)}`)} />}

      <ListSection>
        {(members.data ?? [])
          .filter((m) => m.isMe)
          .map((me) => (
            <ListRow
              key={me.userId}
              icon="close-circle-outline"
              tone="error"
              title={t('groupChat.info.leave')}
              onPress={() => leave(me.userId)}
            />
          ))}
      </ListSection>
    </NavScreen>
  );
}
