import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { type ReelComment, useAddComment, useReelComments, useRemoveComment } from '@/data/reels';
import { useSession } from '@/features/auth/session';
import { initials } from '@/features/planner/plan-together';
import { inboxTime } from '@/features/chat/chat-format';
import { useLocale } from '@/i18n/locale-context';

/**
 * A reel's comments (a sheet): oldest first, each with "Bal S.", when, and
 * a hold for Report, or Delete on your own (the reel's poster can also hide
 * any comment on it). Writing one asks you to sign in first.
 * `?reel={id}`, and `?mine=1` when it's your reel.
 */
export default function ReelCommentsScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { reel = '', mine } = useLocalSearchParams<{ reel?: string; mine?: string }>();
  const { requireSignIn } = useSession();
  const comments = useReelComments(reel);
  const add = useAddComment(reel);
  const remove = useRemoveComment(reel);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const type = useTypeStyle({ variant: 'body' });
  const close = () => router.canGoBack() && router.back();

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setError(undefined);
    requireSignIn(() =>
      add.mutate(body, {
        onSuccess: () => setText(''),
        onError: (e) =>
          setError(
            e.message.includes('comment_limit')
              ? t('reels.commentLimit')
              : t('reels.commentFailed'),
          ),
      }),
    );
  };

  const hold = (comment: ReelComment) => {
    const canRemove = comment.isMine || mine === '1';
    const choices = [
      ...(canRemove
        ? [
            {
              text: comment.isMine ? t('reels.deleteComment') : t('reels.hideComment'),
              style: 'destructive' as const,
              onPress: () => remove.mutate({ id: comment.id, mine: comment.isMine }),
            },
          ]
        : []),
      ...(!comment.isMine
        ? [
            {
              text: t('reels.reportComment'),
              onPress: () =>
                requireSignIn(() =>
                  router.push({ pathname: '/reel-report', params: { comment: comment.id } }),
                ),
            },
          ]
        : []),
    ];
    if (choices.length === 0) return;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(choices[0].text)) choices[0].onPress();
      return;
    }
    Alert.alert(comment.name ?? '', undefined, [
      ...choices,
      { text: t('reels.cancel'), style: 'cancel' },
    ]);
  };

  let body;
  if (comments.isPending) body = <StateView state="loading" />;
  else if (comments.isError)
    body = <StateView state="error" onRetry={() => void comments.refetch()} />;
  else if (comments.data.length === 0)
    body = <StateView state="empty" icon="chatbubble-outline" message={t('reels.noComments')} />;
  else
    body = (
      <FlatList
        data={comments.data}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => hold(item)}
            accessibilityHint={t('reels.commentHint')}
            style={styles.comment}
          >
            <View style={[styles.avatar, { backgroundColor: Colors.primaryTint }]}>
              <AppText variant="label" weight={700} color="primary">
                {initials(item.name)}
              </AppText>
            </View>
            <View style={styles.grow}>
              <AppText variant="label" weight={700}>
                {item.name ?? t('reels.someone')}{' '}
                <AppText variant="caption" color="text2">
                  {inboxTime(item.createdAt, t)}
                </AppText>
              </AppText>
              <AppText>{item.body}</AppText>
            </View>
          </Pressable>
        )}
      />
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} title={t('reels.commentsTitle')} />
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={60}
      >
        <View style={styles.grow}>{body}</View>
        {error && <FieldError message={error} />}
        <View style={[styles.composer, { backgroundColor: Colors.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('reels.addComment')}
            placeholderTextColor={Colors.text2}
            accessibilityLabel={t('reels.addComment')}
            maxLength={500}
            multiline
            style={[styles.input, type, { color: Colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reels.post')}
            disabled={!text.trim() || add.isPending}
            onPress={send}
            hitSlop={8}
            style={[
              styles.send,
              { backgroundColor: text.trim() ? Colors.primaryFill : Colors.fill },
            ]}
          >
            <Icon name="arrow-up" size={20} color={Colors.onPrimary} weight="bold" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  list: {
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
