import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { useConversations, useIsVendor, type Conversation } from '@/data/chat';
import { useSession } from '@/features/auth/session';
import { inboxTime, lastMessagePreview } from '@/features/chat/chat-format';
import { PushAskCard } from '@/features/chat/push-ask';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Messages: every conversation, newest first. Families see the vendors they
 * wrote to; a vendor account sees its families too, marked with the business
 * name. Unread ones are bold with a count. /messages
 */
export default function MessagesScreen() {
  const { t } = useLocale();
  const { status } = useSession();
  const conversations = useConversations();
  const { isVendor } = useIsVendor();

  let body;
  if (status === 'loading') {
    body = <StateView state="loading" />;
  } else if (status !== 'signedIn') {
    body = (
      <View>
        <StateView state="empty" icon="chatbubbles-outline" message={t('chat.signIn')} />
        <Button label={t('profile.account.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
    );
  } else if (conversations.isPending) {
    body = <StateView state="loading" />;
  } else if (conversations.isError) {
    body = <StateView state="error" onRetry={() => void conversations.refetch()} />;
  } else if (conversations.data.length === 0) {
    body = <StateView state="empty" icon="chatbubbles-outline" message={t('chat.empty')} />;
  } else {
    body = <Inbox conversations={conversations.data} />;
  }

  return (
    <NavScreen title={t('chat.title')}>
      {/* Vendors: a buzz when a family writes, so no one waits on them */}
      {isVendor && status === 'signedIn' && <PushAskCard audience="vendor" />}
      {body}
    </NavScreen>
  );
}

function Inbox({ conversations }: { conversations: Conversation[] }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      {conversations.map((conversation, i) => (
        <InboxRow key={conversation.id} conversation={conversation} divided={i > 0} />
      ))}
    </View>
  );
}

function InboxRow({ conversation, divided }: { conversation: Conversation; divided: boolean }) {
  const styles = useStyles();
  const { t } = useLocale();
  const vendorName = localized(conversation.vendor.name);
  const asVendor = conversation.side === 'vendor';
  const title = asVendor ? (conversation.family.firstName ?? t('chat.aFamily')) : vendorName;
  const unread = conversation.unreadCount > 0;
  const preview = lastMessagePreview(conversation, t);
  const time = inboxTime(conversation.updatedAt, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        asVendor ? t('chat.forBusiness', { name: vendorName }) : null,
        unread ? t('chat.unread', { count: conversation.unreadCount }) : null,
        preview,
        time,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      {conversation.vendor.photoUrl && !asVendor ? (
        <Image
          source={{ uri: conversation.vendor.photoUrl }}
          contentFit="cover"
          accessible={false}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.initial]}>
          <AppText variant="heading" color="primary">
            {title.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.top}>
          <AppText weight={unread ? 700 : 600} numberOfLines={1} style={styles.name}>
            {title}
          </AppText>
          <AppText
            variant="caption"
            color={unread ? 'primary' : 'text2'}
            weight={unread ? 600 : 400}
          >
            {time}
          </AppText>
        </View>
        {asVendor && (
          <AppText variant="caption" color="text2" numberOfLines={1}>
            {t('chat.forBusiness', { name: vendorName })}
          </AppText>
        )}
        <View style={styles.top}>
          <AppText
            color={unread ? 'text' : 'text2'}
            weight={unread ? 600 : 400}
            numberOfLines={2}
            style={styles.name}
          >
            {preview}
          </AppText>
          {unread && (
            <View style={styles.badge}>
              <AppText variant="caption" weight={700} color="onPrimary">
                {String(conversation.unreadCount)}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const AVATAR = 52;

const useStyles = makeStyles((Colors) => ({
  group: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: Sizes.row + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: Colors.skeleton,
  },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primaryFill,
  },
}));
