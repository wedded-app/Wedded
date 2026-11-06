import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { VaultIcon } from '@/components/vault-icon';
import { makeStyles, Spacing, useColors, type ColorToken } from '@/constants/theme';
import { useGuests } from '@/data/guests';
import { useMemoryVault, useOpenMemoryVault } from '@/data/memory-vault';
import { totalsLine } from '@/features/guests/guest-helpers';
import { useSiteStatus } from '@/features/website/website-card';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

/**
 * For your guests on the Wedding tab, as four tiles two across instead of
 * a list: the guest list and who's coming, the wedding website (draft or
 * live), invitation cards, and the Memory Vault. Each says where it's at in
 * a few words. The guest list is only for those who can change the plan
 * (it's other people's numbers); the vault shows once it's open, or to them
 * so they can open it.
 */
export function GuestTiles({ weddingId, canEdit }: { weddingId: string | null; canEdit: boolean }) {
  const styles = useStyles();
  const { t } = useLocale();
  const guests = useGuests(canEdit ? weddingId : null);
  const vault = useMemoryVault(weddingId);
  const openVault = useOpenMemoryVault();
  const guestLine = totalsLine(guests.data ?? [], t);

  const openTheVault = () => {
    if (vault.data) return router.push({ pathname: '/vault/[id]', params: { id: vault.data.id } });
    if (!weddingId || openVault.isPending) return;
    openVault.mutate(weddingId, {
      onSuccess: (id) => {
        successHaptic();
        router.push({ pathname: '/vault/[id]', params: { id } });
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {canEdit && (
          <Tile
            icon="people-outline"
            title={t('guests.title')}
            line={guestLine ?? t('planner.tiles.guests')}
            onPress={() => router.push('/guests')}
          />
        )}
        {weddingId && <WebsiteTile weddingId={weddingId} />}
        <Tile
          icon="mail-outline"
          title={t('planner.tiles.cardsTitle')}
          line={t('planner.tiles.cards')}
          onPress={() => router.push('/cards')}
        />
        {weddingId && !vault.isPending && (vault.data || canEdit) && (
          <Tile
            glyph={<VaultIconTinted />}
            title={t('memoryVault.title')}
            line={
              vault.data
                ? t('memoryVault.count', { count: vault.data.itemCount })
                : openVault.isPending
                  ? t('memoryVault.opening')
                  : t('planner.tiles.vault')
            }
            onPress={openTheVault}
          />
        )}
      </View>
      {openVault.isError && <FieldError message={t('memoryVault.openFailed')} />}
    </View>
  );
}

function WebsiteTile({ weddingId }: { weddingId: string }) {
  const { t } = useLocale();
  const { slug, site } = useSiteStatus(weddingId);
  const live = !!site?.publishedAt;
  return (
    <Tile
      icon="globe-outline"
      title={t('website.title')}
      line={
        !slug
          ? t('planner.tiles.siteNew')
          : live
            ? t('planner.tiles.siteLive')
            : t('planner.tiles.siteDraft')
      }
      lineColor={live ? 'success' : 'text2'}
      onPress={() => router.push('/website')}
    />
  );
}

function VaultIconTinted() {
  const Colors = useColors();
  return <VaultIcon size={22} color={Colors.primary} />;
}

function Tile({
  icon,
  glyph,
  title,
  line,
  lineColor = 'text2',
  onPress,
}: {
  icon?: IconName;
  glyph?: ReactNode;
  title: string;
  line: string;
  lineColor?: ColorToken;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${line}`}
      pressedScale={0.97}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={styles.tile}
    >
      <View style={styles.icon}>
        {glyph ?? (icon && <Icon name={icon} size={22} color={Colors.primary} />)}
      </View>
      <View style={styles.words}>
        <AppText weight={600}>{title}</AppText>
        <AppText variant="label" weight={400} color={lineColor} numberOfLines={2}>
          {line}
        </AppText>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 128,
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  words: {
    gap: 2,
  },
}));
