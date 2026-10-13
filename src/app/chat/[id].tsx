import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { BookingCard } from '@/components/chat/booking-card';
import { Composer } from '@/components/chat/composer';
import { DaySeparator } from '@/components/chat/day-separator';
import { MessageRow, PhotoBubble, TextBubble } from '@/components/chat/message-row';
import { PhoneCard } from '@/components/chat/phone-card';
import { ReactionChips } from '@/components/chat/reaction-chips';
import { ReactionPicker } from '@/components/chat/reaction-picker';
import { QuoteCard } from '@/components/chat/quote-card';
import { ReplyBar, ReplyQuote } from '@/components/chat/reply-quote';
import { SwipeToReply } from '@/components/chat/swipe-to-reply';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { MenuCard } from '@/components/menu-card';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import {
  sendErrorKind,
  useChatPhotoUrl,
  useConversation,
  useReactToMessage,
  useSendMessage,
  type Conversation,
  type Message,
} from '@/data/chat';
import { useTyping } from '@/data/chat-typing';
import { setOpenConversation } from '@/data/push';
import { useVendorMenus } from '@/data/vendor-menus';
import { leadAnswerRows } from '@/features/business/business-format';
import { useEventNames } from '@/features/business/business-parts';
import { messageSnippet } from '@/features/chat/chat-format';
import { PushAskCard } from '@/features/chat/push-ask';
import { sentPhotoUri } from '@/features/chat/chat-photo';
import { nextReaction, type ReactionCode } from '@/features/chat/reactions';
import { layoutThread, type ThreadItem } from '@/features/chat/thread-layout';
import { type PhotoUpload, usePhotoSender } from '@/features/chat/use-photo-sender';
import { useSession } from '@/features/auth/session';
import { usd } from '@/features/vendors/profile-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';

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
  const { t, locale } = useLocale();
  const thread = useConversation(id);
  const send = useSendMessage(id);
  const react = useReactToMessage(id);
  // The message being reacted to, while the picker is open (hold a message)
  const [reactingTo, setReactingTo] = useState<Message | null>(null);
  const myReaction = (message: Message) => message.reactions.find((r) => r.mine)?.code ?? null;
  const toggleReaction = (message: Message, picked: ReactionCode) =>
    react.mutate({ messageId: message.id, reaction: nextReaction(myReaction(message), picked) });
  const photos = usePhotoSender(id, send);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const input = useRef<TextInput>(null);
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

  // Asked first, with the number shown, since it can't be taken back
  const shareNumber = () => {
    if (!profile?.phone) return;
    const number = formatPhone(profile.phone);
    const share = () => send.mutate({ kind: 'phone' });
    if (Platform.OS === 'web') {
      if (globalThis.confirm(t('chat.phone.confirm', { number }))) share();
      return;
    }
    Alert.alert(t('chat.phone.confirmTitle'), t('chat.phone.confirm', { number }), [
      { text: t('chat.phone.cancel'), style: 'cancel' },
      { text: t('chat.phone.share'), onPress: share },
    ]);
  };

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

  let error: string | null = photos.notice;
  if (send.isError) error = t(`chat.errors.${sendErrorKind(send.error)}`);

  const title = convo
    ? side === 'vendor'
      ? (convo.family.firstName ?? t('chat.aFamily'))
      : localized(convo.vendor.name, locale)
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
    <GestureHandlerRootView style={styles.root}>
      <Screen edges={['top']}>
        <View style={styles.bar}>
          <BackButton />
          {convo && (
            <Pressable
              accessibilityRole={side === 'family' ? 'link' : 'header'}
              accessibilityLabel={
                side === 'family' ? t('chat.openProfile', { name: title }) : title
              }
              disabled={side !== 'family'}
              onPress={() =>
                router.push({ pathname: '/v/[slug]', params: { slug: convo.vendor.slug } })
              }
              style={({ pressed }) => [styles.titleWrap, pressed && styles.pressed]}
            >
              <AppText variant="heading" weight={700} numberOfLines={1}>
                {title}
              </AppText>
              <AppText
                variant="caption"
                color={side === 'family' ? 'primary' : 'text2'}
                numberOfLines={1}
              >
                {side === 'family'
                  ? t('chat.viewProfile')
                  : t('chat.forBusiness', { name: localized(convo.vendor.name, locale) })}
              </AppText>
            </Pressable>
          )}
        </View>

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
                ) : null
              }
            />
          )}

          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            {error && (
              <View style={styles.error}>
                <FieldError message={error} />
              </View>
            )}
            {side === 'vendor' && convo && (
              <View style={styles.tools}>
                <Chip
                  role="button"
                  label={t('chat.sendQuote')}
                  onPress={() => router.push({ pathname: '/chat-quote', params: { id } })}
                />
                <Chip
                  role="button"
                  label={t('chat.sendMenu')}
                  onPress={() =>
                    router.push({
                      pathname: '/chat-menu',
                      params: { id, vendorId: convo.vendor.id },
                    })
                  }
                />
              </View>
            )}
            {side === 'family' && convo && profile?.phone && !sharedNumber && (
              <View style={styles.tools}>
                <Chip role="button" label={t('chat.phone.shareButton')} onPress={shareNumber} />
              </View>
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
  );
}

type Row = ThreadItem | { type: 'upload'; key: string; upload: PhotoUpload };

/** A photo of mine still on its way: "Sending…", or what went wrong and what to do. */
function UploadRow({
  upload,
  quoted,
  authorOf,
  onShowOriginal,
  onRetry,
  onRemove,
}: {
  upload: PhotoUpload;
  /** The message it replies to, as in ThreadRow. */
  quoted: Message | null | undefined;
  authorOf: (message: Message) => string;
  onShowOriginal: (messageId: string) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const failed = upload.status === 'failed';
  const quotedName = quoted ? authorOf(quoted) : '';
  const quotedText = quoted ? messageSnippet(quoted, t) : t('chat.reply.unavailable');
  return (
    <View style={styles.upload}>
      {quoted !== undefined && (
        <ReplyQuote
          name={quotedName}
          text={quotedText}
          spoken={t('chat.reply.inReplyTo', { name: quotedName, text: quotedText })}
          onPress={quoted ? () => onShowOriginal(quoted.id) : undefined}
          hint={t('chat.reply.showHint')}
        />
      )}
      <View style={failed ? null : styles.pending}>
        <PhotoBubble url={upload.uri} label={t('chat.photo')} />
      </View>
      {failed ? (
        <>
          <AppText variant="caption" color="error" style={styles.uploadText}>
            {t('chat.photos.failed')}
          </AppText>
          <View style={styles.uploadActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
            >
              <AppText weight={700} color="primary">
                {t('chat.photos.tryAgain')}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onRemove}
              style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
            >
              <AppText weight={700} color="text2">
                {t('chat.photos.remove')}
              </AppText>
            </Pressable>
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

/**
 * What a reply quotes: the message, null when it isn't loaded or is gone,
 * or undefined when the message isn't a reply.
 */
function quotedFor(message: Message, byId: Map<string, Message>): Message | null | undefined {
  if (!message.replyTo) return undefined;
  return byId.get(message.replyTo) ?? null;
}

/**
 * A day heading or one message, drawn by its kind: the message it replies to
 * above it, swipe it to reply, hold it to react, its reactions under it.
 */
function ThreadRow({
  item,
  conversation,
  quoted,
  authorOf,
  lit,
  onShowOriginal,
  onStartReply,
  onReply,
  onSend,
  onHold,
  onToggleReaction,
}: {
  item: ThreadItem;
  conversation: Conversation | null;
  /** The message this one replies to; null when it's gone, undefined when it isn't a reply. */
  quoted: Message | null | undefined;
  authorOf: (message: Message) => string;
  /** Lit up for a moment: a quote of it was just tapped. */
  lit: boolean;
  /** A quote was tapped: show the original. */
  onShowOriginal: (messageId: string) => void;
  /** Swiped (or the Reply action): start a reply to it (C5d). */
  onStartReply: (message: Message) => void;
  onReply: (text: string) => void;
  onSend: (text: string) => void;
  /** Held: pick a reaction (C5c). */
  onHold: (message: Message) => void;
  onToggleReaction: (message: Message, reaction: ReactionCode) => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  if (item.type === 'day') return <DaySeparator day={item.day} />;
  const { message, mine, first, last, seen } = item;
  // Not until it's saved: a reaction or a reply needs the message's real id
  const saved = !message.id.startsWith('pending-');
  const wide =
    message.kind === 'quote' ||
    message.kind === 'menu' ||
    message.kind === 'booking' ||
    message.kind === 'phone';
  const quotedName = quoted ? authorOf(quoted) : '';
  const quotedText = quoted ? messageSnippet(quoted, t) : t('chat.reply.unavailable');
  return (
    <View style={[saved ? null : styles.pending, lit && styles.lit]}>
      <MessageRow mine={mine} last={last} seen={seen} createdAt={message.createdAt} wide={wide}>
        {quoted !== undefined && (
          <ReplyQuote
            name={quotedName}
            text={quotedText}
            spoken={t('chat.reply.inReplyTo', { name: quotedName, text: quotedText })}
            onPress={quoted ? () => onShowOriginal(quoted.id) : undefined}
            hint={t('chat.reply.showHint')}
          />
        )}
        <SwipeToReply
          enabled={saved}
          align={wide ? 'stretch' : mine ? 'right' : 'left'}
          onReply={() => onStartReply(message)}
        >
          <Pressable
            onLongPress={saved ? () => onHold(message) : undefined}
            delayLongPress={350}
            // Screen readers react and reply through actions, instead of holding and swiping
            accessibilityActions={
              saved
                ? [
                    { name: 'react', label: t('chat.react.action') },
                    { name: 'reply', label: t('chat.reply.action') },
                  ]
                : []
            }
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'react') onHold(message);
              if (e.nativeEvent.actionName === 'reply') onStartReply(message);
            }}
          >
            <MessageContent
              message={message}
              mine={mine}
              first={first}
              last={last}
              conversation={conversation}
              onReply={onReply}
              onSend={onSend}
            />
          </Pressable>
        </SwipeToReply>
        <ReactionChips
          reactions={message.reactions}
          mine={mine}
          onToggle={(reaction) => onToggleReaction(message, reaction)}
        />
      </MessageRow>
    </View>
  );
}

function MessageContent({
  message,
  mine,
  first,
  last,
  conversation,
  onReply,
  onSend,
}: {
  message: Message;
  mine: boolean;
  first: boolean;
  last: boolean;
  conversation: Conversation | null;
  onReply: (text: string) => void;
  onSend: (text: string) => void;
}) {
  const { t } = useLocale();
  // Names from every tradition: a vendor's families can be from any
  const eventName = useEventNames();

  switch (message.kind) {
    case 'photo':
      return <ChatPhoto path={message.photoPath} label={t('chat.photo')} />;
    case 'quote':
      return message.quote ? (
        <QuoteCard
          quote={message.quote}
          eventName={message.quote.eventSlug ? eventName(message.quote.eventSlug) : null}
          onAccept={
            !mine && conversation?.side === 'family'
              ? () =>
                  onSend(
                    t('chat.quote.acceptMessage', {
                      amount: usd.format(message.quote?.amount ?? 0),
                    }),
                  )
              : undefined
          }
          onAsk={
            !mine && conversation?.side === 'family'
              ? () => onReply(t('chat.quote.askPrefix'))
              : undefined
          }
        />
      ) : null;
    case 'menu':
      return message.menuId && conversation ? (
        <ChatMenu vendorId={conversation.vendor.id} menuId={message.menuId} />
      ) : null;
    case 'booking':
      return message.booking ? (
        <BookingCard
          booking={message.booking}
          eventNames={message.booking.eventSlugs.map(eventName)}
          guestLabel={
            message.booking.guestBand ? t(`inquiry.guestBands.${message.booking.guestBand}`) : null
          }
          answers={leadAnswerRows(message.booking.details, t, eventName)}
        />
      ) : null;
    case 'phone':
      return message.phone ? <PhoneCard phone={message.phone} mine={mine} /> : null;
    default:
      return <TextBubble text={message.body ?? ''} mine={mine} first={first} last={last} />;
  }
}

function ChatPhoto({ path, label }: { path: string | null; label: string }) {
  const styles = useStyles();
  // A photo sent from this phone shows from the phone's copy at once
  const local = sentPhotoUri(path);
  const url = useChatPhotoUrl(local ? null : path);
  const uri = local ?? url.data;
  if (!uri) return <View style={styles.photoWait} accessibilityLabel={label} />;
  return <PhotoBubble url={uri} label={label} />;
}

function ChatMenu({ vendorId, menuId }: { vendorId: string; menuId: string }) {
  const menus = useVendorMenus(vendorId);
  const menu = menus.data?.find((m) => m.id === menuId);
  if (!menu) return null;
  return (
    <MenuCard
      menu={menu}
      onPress={() => router.push({ pathname: '/menu', params: { vendorId, menuId } })}
    />
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
  pending: {
    opacity: 0.6,
  },
  lit: {
    marginHorizontal: -Sizes.pageGutter,
    paddingHorizontal: Sizes.pageGutter,
    backgroundColor: Colors.primaryTint,
  },
  photoWait: {
    width: 240,
    height: 240,
    borderRadius: 18,
    backgroundColor: Colors.skeleton,
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
  upload: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '82%',
    gap: 3,
    marginTop: Spacing.sm,
  },
  uploadText: {
    textAlign: 'right',
  },
  uploadActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  uploadButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
}));
