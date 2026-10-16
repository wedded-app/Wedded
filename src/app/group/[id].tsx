import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Composer } from '@/components/chat/composer';
import { DaySeparator } from '@/components/chat/day-separator';
import { MessageRow, PhotoBubble, TextBubble } from '@/components/chat/message-row';
import { ReplyBar, ReplyQuote } from '@/components/chat/reply-quote';
import { SwipeToReply } from '@/components/chat/swipe-to-reply';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { useChatPhotoUrl } from '@/data/chat';
import {
  groupErrorKind,
  useGroupMembers,
  useGroupMessages,
  useGroupThreads,
  useSendGroupMessage,
  type GroupMessage,
} from '@/data/group-chat';
import { setOpenConversation } from '@/data/push';
import { useSession } from '@/features/auth/session';
import { sentPhotoUri } from '@/features/chat/chat-photo';
import { layoutThread, type ThreadItem } from '@/features/chat/thread-layout';
import { type PhotoUpload, usePhotoSender } from '@/features/chat/use-photo-sender';
import { senderKey, senderName, wedState } from '@/features/group-chat/group-format';
import { WedMark } from '@/features/wed/wed-mark';
import { useLocale } from '@/i18n/locale-context';

type Threaded = GroupMessage & { createdAt: string; senderRole: string };
type Row = ThreadItem<Threaded> | { type: 'upload'; key: string; upload: PhotoUpload };

const ASKS_WED = /(^|[^\w])@wed(\W|$)/i;

/**
 * A family group chat (A2, #125): everyone's messages with their names, Wed's
 * answers when someone writes "@Wed", photos, and swipe to reply. The title
 * opens who's in it. Live; opening it marks it read. /group/{thread id}
 */
export default function GroupThreadScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session?.user.id ?? null;
  const threads = useGroupThreads();
  const thread = threads.data?.find((th) => th.id === id) ?? null;
  const messages = useGroupMessages(id);
  const members = useGroupMembers(id);
  const send = useSendGroupMessage(id);
  const photos = usePhotoSender(id, {
    mutateAsync: ({ path, width, height, replyTo }) =>
      send.mutateAsync({ photo: { path, width, height }, replyTo: replyTo ?? undefined }),
  });
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const input = useRef<TextInput>(null);

  // Alerts for this thread don't pop up while it's on screen
  useFocusEffect(
    useCallback(() => {
      setOpenConversation(id);
      return () => setOpenConversation(null);
    }, [id]),
  );

  const names = new Map((members.data ?? []).map((m) => [m.userId, m.name]));
  const all = messages.data ?? [];
  const byId = new Map(all.map((m) => [m.id, m]));
  const nameOf = (m: GroupMessage) =>
    m.sender_user_id === me ? t('groupChat.you') : senderName(m, names, t);

  const sendText = () => {
    const body = draft.trim();
    if (!body) return;
    send.mutate({ body, replyTo: replyingTo?.id });
    setDraft('');
    setReplyingTo(null);
  };

  const askWed = () => {
    setDraft((text) => (ASKS_WED.test(text) ? text : `@Wed ${text}`));
    input.current?.focus();
  };

  const startReply = (message: GroupMessage) => {
    setReplyingTo(message);
    input.current?.focus();
  };

  // Newest at the bottom: an inverted list takes the rows newest first
  const items: Row[] = [
    ...photos.uploads
      .map((upload) => ({ type: 'upload' as const, key: upload.id, upload }))
      .reverse(),
    ...layoutThread<Threaded>(
      all.map((m) => ({ ...m, createdAt: m.created_at, senderRole: senderKey(m) })),
      me ?? '',
    ).reverse(),
  ];
  const wed = wedState(all, me);

  let error = photos.notice;
  if (send.isError) error = t(`groupChat.errors.${groupErrorKind(send.error)}`);

  let body;
  if (messages.isPending || threads.isPending) {
    body = <StateView state="loading" />;
  } else if (messages.isError) {
    body = <StateView state="error" onRetry={() => void messages.refetch()} />;
  } else if (!thread) {
    body = (
      <StateView state="empty" icon="chatbubbles-outline" message={t('groupChat.unavailable')} />
    );
  } else {
    body = (
      <FlatList
        inverted
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.type === 'upload' ? (
            <UploadRow
              upload={item.upload}
              onRetry={() => photos.retry(item.upload)}
              onRemove={() => photos.remove(item.upload.id)}
            />
          ) : item.type === 'day' ? (
            <DaySeparator day={item.day} />
          ) : (
            <GroupRow
              item={item}
              name={nameOf(item.message)}
              quoted={item.message.reply_to ? (byId.get(item.message.reply_to) ?? null) : undefined}
              nameOf={nameOf}
              onReply={startReply}
            />
          )
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={<View style={styles.top} />}
        // Inverted, the header sits at the bottom, under the newest message
        ListHeaderComponent={
          wed === 'thinking' ? (
            <TypingIndicator label={t('groupChat.wedThinking')} />
          ) : wed === 'failed' ? (
            <AppText variant="caption" color="text2" style={styles.wedFailed}>
              {t('groupChat.wedFailed')}
            </AppText>
          ) : null
        }
      />
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Screen edges={['top']}>
        <View style={styles.bar}>
          <BackButton />
          {thread && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('groupChat.openInfo')}
              onPress={() => router.push({ pathname: '/group-info', params: { id } })}
              style={({ pressed }) => [styles.titleWrap, pressed && styles.pressed]}
            >
              <AppText variant="heading" weight={700} numberOfLines={1}>
                {thread.name}
              </AppText>
              <AppText variant="caption" color="primary" numberOfLines={1}>
                {t('groupChat.people', { count: thread.memberCount })}
              </AppText>
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
          {thread && (
            <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
              {error && (
                <View style={styles.padded}>
                  <FieldError message={error} />
                </View>
              )}
              {!ASKS_WED.test(draft) && (
                <View style={styles.tools}>
                  <Chip role="button" label={t('groupChat.askWed')} onPress={askWed} />
                </View>
              )}
              {replyingTo && (
                <ReplyBar
                  title={t('chat.reply.replyingTo', { name: nameOf(replyingTo) })}
                  text={snippet(replyingTo, t)}
                  cancelLabel={t('chat.reply.cancel')}
                  onCancel={() => setReplyingTo(null)}
                />
              )}
              <Composer
                inputRef={input}
                value={draft}
                onChangeText={setDraft}
                onSend={sendText}
                onAddPhoto={() =>
                  void photos.pick(replyingTo?.id).then((picked) => {
                    if (picked) setReplyingTo(null);
                  })
                }
                sending={send.isPending}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </Screen>
    </GestureHandlerRootView>
  );
}

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** A quoted message in a line: its words, or "Photo". */
function snippet(message: GroupMessage, t: Translate): string {
  if (message.kind === 'photo') return message.body ?? t('chat.photo');
  return message.body ?? '';
}

/** One message (or a joined / left line), with the writer's name over the first of their run. */
function GroupRow({
  item,
  name,
  quoted,
  nameOf,
  onReply,
}: {
  item: Extract<ThreadItem<Threaded>, { type: 'message' }>;
  name: string;
  /** The message it replies to; null when gone, undefined when it isn't a reply. */
  quoted: GroupMessage | null | undefined;
  nameOf: (message: GroupMessage) => string;
  onReply: (message: GroupMessage) => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const { message, mine, first, last } = item;

  if (message.sender_role === 'system') {
    return (
      <AppText variant="caption" color="text2" style={styles.line}>
        {t(message.kind === 'left' ? 'groupChat.left' : 'groupChat.joined', { name })}
      </AppText>
    );
  }

  const isWed = message.sender_role === 'wed';
  const quotedName = quoted ? nameOf(quoted) : '';
  const quotedText = quoted ? snippet(quoted, t) : t('chat.reply.unavailable');
  const photoPath = message.kind === 'photo' ? (message.data as { path?: string }).path : null;
  return (
    <MessageRow mine={mine} last={last} seen={false} createdAt={message.created_at}>
      {!mine && first && (
        <View style={styles.name}>
          {isWed && <WedMark size={16} color="primary" />}
          <AppText variant="caption" weight={700} color={isWed ? 'primary' : 'text2'}>
            {name}
          </AppText>
        </View>
      )}
      {quoted !== undefined && (
        <ReplyQuote
          name={quotedName}
          text={quotedText}
          spoken={t('chat.reply.inReplyTo', { name: quotedName, text: quotedText })}
          hint={t('chat.reply.showHint')}
        />
      )}
      <SwipeToReply align={mine ? 'right' : 'left'} onReply={() => onReply(message)}>
        <Pressable
          accessibilityLabel={mine ? undefined : name}
          accessibilityActions={[{ name: 'reply', label: t('chat.reply.action') }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'reply') onReply(message);
          }}
        >
          {photoPath ? (
            <View style={styles.photo}>
              <GroupPhoto path={photoPath} label={t('chat.photoFrom', { name })} />
              {message.body && (
                <TextBubble text={message.body} mine={mine} first={false} last={last} />
              )}
            </View>
          ) : (
            <TextBubble text={message.body ?? ''} mine={mine} first={first} last={last} />
          )}
        </Pressable>
      </SwipeToReply>
    </MessageRow>
  );
}

function GroupPhoto({ path, label }: { path: string; label: string }) {
  const styles = useStyles();
  // A photo sent from this phone shows from the phone's copy at once
  const local = sentPhotoUri(path);
  const url = useChatPhotoUrl(local ? null : path);
  const uri = local ?? url.data;
  if (!uri) return <View style={styles.photoWait} accessibilityLabel={label} />;
  return <PhotoBubble url={uri} label={label} />;
}

/** A photo of mine on its way: "Sending…", or Try again and Remove. */
function UploadRow({
  upload,
  onRetry,
  onRemove,
}: {
  upload: PhotoUpload;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const failed = upload.status === 'failed';
  return (
    <View style={styles.upload}>
      <View style={failed ? null : styles.pending}>
        <PhotoBubble url={upload.uri} label={t('chat.photo')} />
      </View>
      {failed ? (
        <>
          <AppText variant="caption" color="error">
            {t('chat.photos.failed')}
          </AppText>
          <View style={styles.uploadActions}>
            <Button variant="text" label={t('chat.photos.tryAgain')} onPress={onRetry} />
            <Button variant="text" label={t('chat.photos.remove')} onPress={onRemove} />
          </View>
        </>
      ) : (
        <AppText variant="caption" color="text2" accessibilityLiveRegion="polite">
          {t('chat.photos.sending')}
        </AppText>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
  },
  bar: {
    minHeight: Sizes.navBar + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  titleWrap: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  fill: {
    flex: 1,
    marginHorizontal: -Sizes.pageGutter,
  },
  list: {
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.md,
  },
  top: {
    height: Spacing.lg,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  line: {
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  wedFailed: {
    marginTop: Spacing.sm,
  },
  photo: {
    gap: 4,
  },
  photoWait: {
    width: 240,
    height: 240,
    borderRadius: 18,
    backgroundColor: Colors.skeleton,
  },
  upload: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '82%',
    gap: 3,
    marginTop: Spacing.sm,
  },
  pending: {
    opacity: 0.6,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
  padded: {
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
  tools: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
}));
