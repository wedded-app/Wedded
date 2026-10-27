import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
  type TextInputInstance,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Composer } from '@/components/chat/composer';
import { ReactionPicker } from '@/components/chat/reaction-picker';
import { ReplyBar } from '@/components/chat/reply-quote';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { FieldError } from '@/components/field-error';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import {
  sendErrorKind,
  useConversation,
  useReactToMessage,
  useSendMessage,
  type Message,
} from '@/data/chat';
import { useTyping } from '@/data/chat-typing';
import { setOpenConversation } from '@/data/push';
import { messageSnippet } from '@/features/chat/chat-format';
import { DepositsProvider, useChatDeposits } from '@/features/chat/chat-deposits';
import { ChatTitleBar, ShareNumberChip, VendorChatTools } from '@/features/chat/chat-parts';
import { PushAskCard } from '@/features/chat/push-ask';
import { nextReaction, type ReactionCode } from '@/features/chat/reactions';
import { layoutThread, type ThreadItem } from '@/features/chat/thread-layout';
import { quotedFor, ThreadRow, UploadRow } from '@/features/chat/thread-rows';
import { type PhotoUpload, usePhotoSender } from '@/features/chat/use-photo-sender';
import { useVoiceRecorder } from '@/features/chat/use-voice-recorder';
import { useSession } from '@/features/auth/session';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const QUICK_REPLIES = ['available', 'price', 'visit', 'thanks'] as const;

/**
 * One conversation between a family and a vendor, live. The family's inquiry
 * is the first card; then bubbles, photos, quotes and menus, grouped by day.
 * Either side can send a photo, and sees "… is typing" while the other side
 * writes. Families get quick replies and "Share my number" (their number never
 * reaches the vendor otherwise, C2); vendors get "Send a quote" and "Send a
 * menu", and only ever reply. Holding a message reacts to it; swiping it
 * (or the screen reader's Reply action) replies to it, quoting it above, and
 * tapping a quote scrolls to the original and lights it up for a moment.
 * Opening it marks it read. /chat/{conversation id}
 */
export default function ChatScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const thread = useConversation(id);
  const send = useSendMessage(id);
  const react = useReactToMessage(id);
  // The message being reacted to, while the picker is open (hold a message)
  const [reactingTo, setReactingTo] = useState<Message | null>(null);
  const myReaction = (message: Message) => message.reactions.find((r) => r.mine)?.code ?? null;
  const toggleReaction = (message: Message, picked: ReactionCode) =>
    react.mutate({ messageId: message.id, reaction: nextReaction(myReaction(message), picked) });
  const photos = usePhotoSender(id, send);
  const voice = useVoiceRecorder(id, send);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const input = useRef<TextInputInstance>(null);
  const list = useRef<FlatList<Row>>(null);
  const reduceMotion = useReducedMotion();
  // The original a quote was tapped for, lit up for a moment
  const [lit, setLit] = useState<string | null>(null);
  const unlight = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (unlight.current) clearTimeout(unlight.current);
    },
    [],
  );
  const convo = thread.conversation;
  const side = convo?.side ?? 'family';
  const typing = useTyping(id, convo?.side ?? null);
  const deposits = useChatDeposits(id, side, convo ? localized(convo.vendor.name) : '');
  // Alerts for this chat don't pop up while it's on screen
  useFocusEffect(
    useCallback(() => {
      setOpenConversation(id);
      return () => setOpenConversation(null);
    }, [id]),
  );
  // Once a family has written, offer alerts for the reply
  const familyWrote = side === 'family' && thread.messages.some((m) => m.senderRole === 'family');
  const { profile } = useSession();
  const sharedNumber = thread.messages.some((m) => m.kind === 'phone' && m.senderRole === 'family');

  const sendText = (text: string) => {
    const body = text.trim();
    if (!body) return;
    typing.stopped();
    send.mutate({ kind: 'text', body, replyTo: replyingTo?.id });
    setDraft('');
    setReplyingTo(null);
  };

  // A photo picked while replying goes as the reply
  const sendPhoto = () =>
    void photos.pick(replyingTo?.id).then((picked) => {
      if (picked) setReplyingTo(null);
    });

  const startReply = (message: Message) => {
    setReplyingTo(message);
    input.current?.focus();
  };

  const changeDraft = (text: string) => {
    setDraft(text);
    if (text.trim()) typing.typed();
    else typing.stopped();
  };

  // Newest at the bottom: an inverted list takes the rows newest first,
  // with photos still on their way below everything else.
  const items: Row[] = [
    ...photos.uploads
      .map((upload) => ({ type: 'upload' as const, key: upload.id, upload }))
      .reverse(),
    ...layoutThread(thread.messages, side).reverse(),
  ];
  const familyTexts = thread.messages.filter(
    (m) => m.senderRole === 'family' && m.kind === 'text',
  ).length;

  let error: string | null = voice.notice ?? photos.notice ?? deposits.notice;
  if (send.isError) error = t(`chat.errors.${sendErrorKind(send.error)}`);

  const title = convo
    ? side === 'vendor'
      ? (convo.family.firstName ?? t('chat.aFamily'))
      : localized(convo.vendor.name)
    : '';

  // Who wrote a quoted message, and the messages a reply can point at
  const authorOf = (message: Message) =>
    message.senderRole === side ? t('chat.reply.you') : title;
  const byId = new Map(thread.messages.map((m) => [m.id, m]));

  // Tapping a quote: scroll to the original, light it up, and say so
  const showOriginal = (messageId: string) => {
    const index = items.findIndex((row) => row.key === messageId);
    if (index < 0) return;
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: !reduceMotion });
    setLit(messageId);
    if (unlight.current) clearTimeout(unlight.current);
    unlight.current = setTimeout(() => setLit(null), 1600);
    AccessibilityInfo.announceForAccessibility(t('chat.reply.shown'));
  };

  return (
    <DepositsProvider value={deposits.value}>
      <GestureHandlerRootView style={styles.root}>
        <Screen edges={['top']}>
          <ChatTitleBar conversation={convo} title={title} />

          <KeyboardAvoidingView
            style={styles.fill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            {thread.isPending ? (
              <StateView state="loading" />
            ) : thread.isError ? (
              <StateView state="error" onRetry={() => void thread.refetch()} />
            ) : (
              <FlatList
                ref={list}
                inverted
                data={items}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) =>
                  item.type === 'upload' ? (
                    <UploadRow
                      upload={item.upload}
                      quoted={
                        item.upload.replyTo ? (byId.get(item.upload.replyTo) ?? null) : undefined
                      }
                      authorOf={authorOf}
                      onShowOriginal={showOriginal}
                      onRetry={() => photos.retry(item.upload)}
                      onRemove={() => photos.remove(item.upload.id)}
                    />
                  ) : (
                    <ThreadRow
                      item={item}
                      conversation={convo}
                      quoted={item.type === 'message' ? quotedFor(item.message, byId) : undefined}
                      authorOf={authorOf}
                      lit={item.type === 'message' && item.message.id === lit}
                      onShowOriginal={showOriginal}
                      onStartReply={startReply}
                      onReply={setDraft}
                      onSend={sendText}
                      onHold={(message) => {
                        selectionHaptic();
                        setReactingTo(message);
                      }}
                      onToggleReaction={toggleReaction}
                    />
                  )
                }
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                // An older message far up isn't measured yet: get near it, then try again
                onScrollToIndexFailed={({ index, averageItemLength }) => {
                  list.current?.scrollToOffset({
                    offset: index * averageItemLength,
                    animated: false,
                  });
                  setTimeout(
                    () =>
                      list.current?.scrollToIndex({
                        index,
                        viewPosition: 0.5,
                        animated: !reduceMotion,
                      }),
                    100,
                  );
                }}
                ListFooterComponent={<View style={styles.top} />}
                // Inverted, the header sits at the bottom, under the newest message
                ListHeaderComponent={
                  typing.otherTyping && title ? (
                    <TypingIndicator label={t('chat.typing', { name: title })} />
                  ) : undefined
                }
              />
            )}

            <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
              {error && (
                <View style={styles.error}>
                  <FieldError message={error} />
                  {voice.failed && (
                    <View style={styles.voiceActions}>
                      <Button
                        variant="text"
                        label={t('chat.photos.tryAgain')}
                        onPress={voice.retry}
                      />
                      <Button
                        variant="text"
                        label={t('chat.photos.remove')}
                        onPress={voice.dismiss}
                      />
                    </View>
                  )}
                </View>
              )}
              {side === 'vendor' && convo && (
                <VendorChatTools conversationId={id} vendorId={convo.vendor.id} />
              )}
              {side === 'family' && convo && profile?.phone && !sharedNumber && (
                <ShareNumberChip
                  phone={profile.phone}
                  onShare={() => send.mutate({ kind: 'phone' })}
                />
              )}
              {familyWrote && (
                <View style={styles.error}>
                  <PushAskCard audience="family" />
                </View>
              )}
              {replyingTo && (
                <ReplyBar
                  title={t('chat.reply.replyingTo', { name: authorOf(replyingTo) })}
                  text={messageSnippet(replyingTo, t)}
                  cancelLabel={t('chat.reply.cancel')}
                  onCancel={() => setReplyingTo(null)}
                />
              )}
              <Composer
                inputRef={input}
                value={draft}
                onChangeText={changeDraft}
                onBlur={typing.stopped}
                onSend={() => sendText(draft)}
                onAddPhoto={convo ? sendPhoto : undefined}
                voice={
                  convo
                    ? {
                        mode: voice.mode,
                        elapsedMs: voice.elapsedMs,
                        onHold: voice.hold,
                        onRelease: voice.release,
                        onTap: voice.tap,
                        onCancel: voice.cancel,
                        onSend: voice.sendNow,
                      }
                    : undefined
                }
                sending={send.isPending}
                quickReplies={
                  side === 'family' && familyTexts < 2
                    ? QUICK_REPLIES.map((key) => t(`chat.quickReplies.${key}`))
                    : undefined
                }
                onQuickReply={sendText}
              />
            </View>
          </KeyboardAvoidingView>
          <ReactionPicker
            visible={reactingTo !== null}
            current={reactingTo ? myReaction(reactingTo) : null}
            onPick={(picked) => {
              if (reactingTo) toggleReaction(reactingTo, picked);
              setReactingTo(null);
            }}
            onClose={() => setReactingTo(null)}
          />
        </Screen>
      </GestureHandlerRootView>
    </DepositsProvider>
  );
}

type Row = ThreadItem | { type: 'upload'; key: string; upload: PhotoUpload };

const useStyles = makeStyles((Colors) => ({
  root: {
    flex: 1,
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
  bottom: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
  error: {
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
  voiceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
}));
