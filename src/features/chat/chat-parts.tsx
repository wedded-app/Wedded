import { router } from 'expo-router';
import { Alert, Platform, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { Chip } from '@/components/chip';
import { GlassButton } from '@/components/glass-button';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { useBlockChat, useChatBlocked, type Conversation } from '@/data/chat';
import { usePaymentAccount } from '@/data/deposits';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { confirm } from '@/lib/confirm';
import { formatPhone } from '@/lib/phone';

// The chat screen's title bar and the chips under its thread (/chat/[id]).

/**
 * The chat's top bar: back, then who it's with. For a family the name opens
 * the vendor's page; a vendor sees which of their businesses it's for. The
 * dots at the end report the chat or block it (App Store rule 1.2).
 */
export function ChatTitleBar({
  conversation,
  title,
}: {
  conversation: Conversation | null;
  title: string;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  const side = conversation?.side ?? 'family';
  const id = conversation?.id ?? '';
  const blocked = useChatBlocked(id).data ?? false;
  const block = useBlockChat(id);
  const more = () => {
    const report = () => router.push({ pathname: '/reel-report', params: { chat: id } });
    if (Platform.OS === 'web') {
      // Alert does nothing in a browser: the first choice is the useful one
      if (globalThis.confirm(t('chat.safety.report'))) report();
      return;
    }
    Alert.alert(title, undefined, [
      { text: t('chat.safety.report'), onPress: report },
      blocked
        ? { text: t('chat.safety.unblock'), onPress: () => block.mutate(false) }
        : {
            text: t('chat.safety.block'),
            style: 'destructive',
            onPress: () =>
              confirm(
                t('chat.safety.blockTitle', { name: title }),
                t('chat.safety.blockBody'),
                t('chat.safety.block'),
                t('chat.safety.cancel'),
                () => block.mutate(true),
              ),
          },
      { text: t('chat.safety.cancel'), style: 'cancel' },
    ]);
  };
  return (
    <View style={styles.bar}>
      <BackButton />
      {conversation && (
        <Pressable
          accessibilityRole={side === 'family' ? 'link' : 'header'}
          accessibilityLabel={side === 'family' ? t('chat.openProfile', { name: title }) : title}
          disabled={side !== 'family'}
          onPress={() =>
            router.push({ pathname: '/v/[slug]', params: { slug: conversation.vendor.slug } })
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
              : t('chat.forBusiness', { name: localized(conversation.vendor.name) })}
          </AppText>
        </Pressable>
      )}
      {conversation && (
        <GlassButton
          icon="ellipsis-horizontal"
          accessibilityLabel={t('chat.safety.more')}
          onPress={more}
        />
      )}
    </View>
  );
}

/** A vendor's tools under the chat: send a quote or a menu, and ask for a deposit. */
export function VendorChatTools({
  conversationId,
  vendorId,
}: {
  conversationId: string;
  vendorId: string;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  // Only a vendor families can pay asks for deposits
  const payments = usePaymentAccount(vendorId);
  return (
    <View style={styles.tools}>
      <Chip
        role="button"
        label={t('chat.sendQuote')}
        onPress={() => router.push({ pathname: '/chat-quote', params: { id: conversationId } })}
      />
      <Chip
        role="button"
        label={t('chat.sendMenu')}
        onPress={() =>
          router.push({ pathname: '/chat-menu', params: { id: conversationId, vendorId } })
        }
      />
      {payments.data === 'ready' && (
        <Chip
          role="button"
          label={t('chat.deposit.request')}
          onPress={() => router.push({ pathname: '/chat-deposit', params: { id: conversationId } })}
        />
      )}
    </View>
  );
}

/**
 * A family's "Share my number" (their number never reaches the vendor
 * otherwise, C2). Asked first, with the number shown, since it can't be
 * taken back.
 */
export function ShareNumberChip({ phone, onShare }: { phone: string; onShare: () => void }) {
  const styles = useStyles();
  const { t } = useLocale();
  const shareNumber = () => {
    const number = formatPhone(phone);
    if (Platform.OS === 'web') {
      if (globalThis.confirm(t('chat.phone.confirm', { number }))) onShare();
      return;
    }
    Alert.alert(t('chat.phone.confirmTitle'), t('chat.phone.confirm', { number }), [
      { text: t('chat.phone.cancel'), style: 'cancel' },
      { text: t('chat.phone.share'), onPress: onShare },
    ]);
  };
  return (
    <View style={styles.tools}>
      <Chip role="button" label={t('chat.phone.shareButton')} onPress={shareNumber} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
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
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingTop: Spacing.sm,
  },
}));
