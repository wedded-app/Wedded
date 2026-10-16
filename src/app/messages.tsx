import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { useConversations, useIsVendor, type Conversation } from '@/data/chat';
import { useGroupThreads, type GroupThread } from '@/data/group-chat';
import { useSession } from '@/features/auth/session';
import { inboxTime, lastMessagePreview } from '@/features/chat/chat-format';
import { PushAskCard } from '@/features/chat/push-ask';
import { groupPreview } from '@/features/group-chat/group-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Messages: the family's group chats first (A2, #125), then every conversation
 * with a vendor, newest first. Families see the vendors they wrote to; a
 * vendor account sees its families too, marked with the business name.
 * Unread ones are bold with a count. /messages
 */
export default function MessagesScreen() {
  const { t } = useLocale();
  const { status } = useSession();
  const conversations = useConversations();
  const groups = useGroupThreads();
  const { isVendor } = useIsVendor();
  const groupList = groups.data ?? [];

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
  } else if (conversations.data.length === 0 && groupList.length === 0) {
    body = <StateView state="empty" icon="chatbubbles-outline" message={t('chat.empty')} />;
  } else {
    body = (
      <>
        {groupList.length > 0 && <Groups threads={groupList} />}
        {conversations.data.length > 0 && <Inbox conversations={conversations.data} />}
      </>
    );
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

/** The family's group chats, with the vendor conversations' look. */
function Groups({ threads }: { threads: GroupThread[] }) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.section}>
      <SectionTitle>{t('groupChat.title')}</SectionTitle>
      <View style={styles.group}>
        {threads.map((thread, i) => (
          <Row
            key={thread.id}
            divided={i > 0}
            title={thread.name}
            subtitle={t('groupChat.people', { count: thread.memberCount })}
            preview={groupPreview(thread, t)}
            time={inboxTime(thread.lastMessageAt, t)}
            unreadCount={thread.unreadCount}
            onPress={() => router.push({ pathname: '/group/[id]', params: { id: thread.id } })}
          />
        ))}
      </View>
    </View>
  );
}

function InboxRow({ conversation, divided }: { conversation: Conversation; divided: boolean }) {
  const { t } = useLocale();
  const vendorName = localized(conversation.vendor.name);
  const asVendor = conversation.side === 'vendor';
  return (
    <Row
      divided={divided}
      title={asVendor ? (conversation.family.firstName ?? t('chat.aFamily')) : vendorName}
      subtitle={asVendor ? t('chat.forBusiness', { name: vendorName }) : null}
      photoUrl={asVendor ? null : conversation.vendor.photoUrl}
      preview={lastMessagePreview(conversation, t)}
      time={inboxTime(conversation.updatedAt, t)}
      unreadCount={conversation.unreadCount}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
    />
  );
}

/** One row of the inbox: a photo or initial, the name, the last message, the time and an unread count. */
function Row({
  divided,
  title,
  subtitle,
  photoUrl,
  preview,
  time,
  unreadCount,
  onPress,
}: {
  divided: boolean;
  title: string;
  subtitle: string | null;
  photoUrl?: string | null;
  preview: string;
  time: string;
  unreadCount: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const unread = unreadCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        subtitle,
        unread ? t('chat.unread', { count: unreadCount }) : null,
        preview,
        time,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
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
        {subtitle && (
          <AppText variant="caption" color="text2" numberOfLines={1}>
            {subtitle}
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
                {String(unreadCount)}
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
  // SectionTitle's negative margin expects a gap under it
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
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
