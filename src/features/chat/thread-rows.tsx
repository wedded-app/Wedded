import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BookingCard } from '@/components/chat/booking-card';
import { DaySeparator } from '@/components/chat/day-separator';
import { MessageRow, PhotoBubble, TextBubble } from '@/components/chat/message-row';
import { PhoneCard } from '@/components/chat/phone-card';
import { QuoteCard } from '@/components/chat/quote-card';
import { ReactionChips } from '@/components/chat/reaction-chips';
import { ReplyQuote } from '@/components/chat/reply-quote';
import { SwipeToReply } from '@/components/chat/swipe-to-reply';
import { VoiceBubble } from '@/components/chat/voice-bubble';
import { MenuCard } from '@/components/menu-card';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { useChatPhotoUrl, type Conversation, type Message } from '@/data/chat';
import { useVendorMenus } from '@/data/vendor-menus';
import { leadAnswerRows } from '@/features/business/business-format';
import { useEventNames } from '@/features/business/business-parts';
import { ChatProposal } from '@/features/requests/chat-proposal';
import { usd } from '@/features/vendors/profile-format';
import { useLocale } from '@/i18n/locale-context';

import { messageSnippet } from './chat-format';
import { ChatDeposit } from './chat-deposits';
import { sentPhotoUri } from './chat-photo';
import type { ReactionCode } from './reactions';
import type { ThreadItem } from './thread-layout';
import type { PhotoUpload } from './use-photo-sender';

// The rows of a chat thread (/chat/[id]): a photo on its way, a day heading, or a message by its kind.

/** A photo of mine still on its way: "Sending…", or what went wrong and what to do. */
export function UploadRow({
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
export function quotedFor(
  message: Message,
  byId: Map<string, Message>,
): Message | null | undefined {
  if (!message.replyTo) return undefined;
  return byId.get(message.replyTo) ?? null;
}

/**
 * A day heading or one message, drawn by its kind: the message it replies to
 * above it, swipe it to reply, hold it to react, its reactions under it.
 */
export function ThreadRow({
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
    message.kind === 'phone' ||
    message.kind === 'deposit' ||
    message.kind === 'proposal';
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
    case 'voice':
      return message.voice ? (
        <ChatVoice path={message.voice.path} durationMs={message.voice.durationMs} mine={mine} />
      ) : null;
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
          message={message.body}
        />
      ) : null;
    case 'phone':
      return message.phone ? <PhoneCard phone={message.phone} mine={mine} /> : null;
    case 'deposit':
      return <ChatDeposit message={message} />;
    case 'proposal':
      return <ChatProposal message={message} conversation={conversation} />;
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

function ChatVoice({
  path,
  durationMs,
  mine,
}: {
  path: string;
  durationMs: number;
  mine: boolean;
}) {
  // A voice note sent from this phone plays from the phone's copy
  const local = sentPhotoUri(path);
  const url = useChatPhotoUrl(local ? null : path);
  return <VoiceBubble uri={local ?? url.data ?? null} durationMs={durationMs} mine={mine} />;
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
  pressed: {
    opacity: 0.6,
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
}));
