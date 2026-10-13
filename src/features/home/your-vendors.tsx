import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useConversations } from '@/data/chat';
import type { AccountWedding } from '@/data/wedding';
import { inboxTime } from '@/features/chat/chat-format';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { joinNames, vendorStatusRows, type VendorStatusRow } from './home-feed';
import { SectionHeader } from './section-header';

const SHOWN = 4;

/**
 * Your vendors: where things stand with each vendor the family has asked or
 * booked, so Home is worth opening every day. New replies first (with the
 * unread count), then replies, then the ones still to answer, then booked.
 * A row opens the chat, or the vendor's page for one booked without a chat.
 * Before they've asked anyone it says what will show here, with Find vendors.
 */
export function YourVendors({
  wedding,
  eventName,
  onFind,
}: {
  wedding: AccountWedding | null;
  /** An event's name in the family's language, for "Booked for Jaago". */
  eventName: (slug: string) => string;
  onFind: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const conversations = useConversations();
  const rows = useMemo(
    () => vendorStatusRows(conversations.data ?? [], wedding?.bookedVendors ?? {}),
    [conversations.data, wedding?.bookedVendors],
  );

  if (conversations.isPending && rows.length === 0) return null;

  const subtitle = (row: VendorStatusRow) => {
    const time = row.at ? inboxTime(row.at, t) : '';
    switch (row.status) {
      case 'newReply':
        return t('home.newReply', { time });
      case 'replied':
        return t('home.replied', { time });
      case 'waiting':
        return t('home.waiting', { time });
      case 'booked':
        return row.bookedFor.length > 0
          ? t('home.bookedFor', { events: joinNames(row.bookedFor.map(eventName), t('home.and')) })
          : t('home.bookedPlain');
    }
  };

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.yourVendors')}
        link={rows.length > 0 ? t('home.seeAll') : undefined}
        onLink={() => router.push('/messages')}
      />
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <AppText color="text2">{t('home.vendorsEmpty')}</AppText>
          <PressableScale accessibilityRole="button" onPress={onFind} style={styles.findButton}>
            <Icon name="search" size={18} color={Colors.onPrimary} />
            <AppText variant="label" weight={700} color="onPrimary">
              {t('home.findVendors')}
            </AppText>
          </PressableScale>
        </View>
      ) : (
        <ListSection>
          {rows.slice(0, SHOWN).map((row) => (
            <ListRow
              key={row.key}
              title={localized(row.vendor.name, locale)}
              subtitle={subtitle(row)}
              leading={<VendorAvatar row={row} />}
              trailing={<StatusMark row={row} />}
              onPress={() =>
                row.conversationId
                  ? router.push({ pathname: '/chat/[id]', params: { id: row.conversationId } })
                  : router.push({ pathname: '/v/[slug]', params: { slug: row.vendor.slug } })
              }
            />
          ))}
        </ListSection>
      )}
    </View>
  );
}

function VendorAvatar({ row }: { row: VendorStatusRow }) {
  const styles = useStyles();
  const { locale } = useLocale();
  const name = localized(row.vendor.name, locale);
  return (
    <View style={styles.avatar}>
      {row.vendor.photoUrl ? (
        <Image
          source={{ uri: row.vendor.photoUrl }}
          contentFit="cover"
          style={styles.avatarPhoto}
        />
      ) : (
        <AppText weight={700} color="primary">
          {name.trim().charAt(0).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

function StatusMark({ row }: { row: VendorStatusRow }) {
  const Colors = useColors();
  const styles = useStyles();
  if (row.status === 'newReply') {
    return (
      <View style={styles.badge}>
        <AppText variant="caption" weight={700} color="onPrimary">
          {row.unread > 9 ? '9+' : String(row.unread)}
        </AppText>
      </View>
    );
  }
  if (row.status === 'booked') {
    return <Icon name="checkmark-circle" size={24} color={Colors.success} />;
  }
  return null;
}

const AVATAR = 44;

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  empty: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  findButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryFill,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  avatarPhoto: {
    width: AVATAR,
    height: AVATAR,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
}));
