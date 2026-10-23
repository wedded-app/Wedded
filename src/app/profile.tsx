import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { VaultIcon } from '@/components/vault-icon';
import { WeddingCard } from '@/components/wedding-card';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useMyInquiries } from '@/data/inquiries';
import { useIsVendor, useUnreadCount } from '@/data/chat';
import { useMyVaults } from '@/data/memory-vault';
import { useSavedVendors, type SavedVendor } from '@/data/saved';
import { useSession } from '@/features/auth/session';
import { switchToBusiness } from '@/features/business/app-mode';
import { SectionHeader } from '@/features/home/section-header';
import { bookedCount, usePlan } from '@/features/planner/plan';
import { useWed, type WedState } from '@/features/wed/wed-store';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { formatPhone } from '@/lib/phone';

/**
 * S16 Profile, shaped like an Instagram profile: the person, three counts
 * (saved, asked, booked), two buttons, the wedding countdown and a grid of
 * the vendors they've saved. Settings sit behind the gear, as in most apps.
 * Vendor accounts also get "Switch to business" (business mode, #252) at
 * the top of the list. Wed (the planning helper) has its own short list:
 * what it knows, the apps it can use and how much it does on its own.
 * Founding vendors and "Get listed" live on Home and in Settings, not here
 * too (Hick's law: the same link three times is three more things to read).
 */
export default function ProfileScreen() {
  const { t } = useLocale();
  const unread = useUnreadCount();
  const { isVendor } = useIsVendor();
  const { status } = useSession();
  const requests = useMyInquiries();

  return (
    <NavScreen
      title={t('tabs.profile')}
      trailing={
        <GlassButton
          icon="settings-outline"
          accessibilityLabel={t('settings.title')}
          onPress={() => router.push('/settings')}
          size={44}
        />
      }
    >
      <Header />
      <WeddingCard compact />
      <SavedGrid />
      <VaultsSection />
      <WedSection />
      <ListSection inset>
        {isVendor && (
          <ListRow
            icon="storefront"
            iconColor="kesari"
            title={t('businessMode.switchToBusiness')}
            subtitle={t('businessMode.switchToBusinessHint')}
            onPress={switchToBusiness}
          />
        )}
        {/* Saved left the tab bar for Wed: a plain row here too, not only the count */}
        <ListRow
          icon="heart-outline"
          title={t('tabs.saved')}
          onPress={() => router.push('/saved')}
        />
        {status === 'signedIn' && (
          <ListRow
            icon="paper-plane-outline"
            title={t('profile.myRequests')}
            subtitle={t('profile.myRequestsHint')}
            value={requests.data ? String(requests.data.length) : undefined}
            onPress={() => router.push('/my-inquiries')}
          />
        )}
        <ListRow
          icon="chatbubbles-outline"
          title={t('chat.title')}
          value={unread > 0 ? String(unread) : undefined}
          onPress={() => router.push('/messages')}
        />
        <ListRow
          icon="settings-outline"
          title={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
      </ListSection>
      {/* These lived at the bottom of Home before the final look (2026-10-23) */}
      <ListSection inset>
        <ListRow
          icon="ribbon-outline"
          title={t('home.foundingWall')}
          onPress={() => router.push('/founding')}
        />
        <ListRow
          icon="storefront-outline"
          title={t('home.forVendors')}
          onPress={() => router.push('/for-vendors')}
        />
      </ListSection>
    </NavScreen>
  );
}

/** The person (or a sign-in prompt), their counts and the two buttons. */
function Header() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status, profile, email, reloadProfile } = useSession();
  const saves = useSavedVendors();
  const inquiries = useMyInquiries();
  const plan = usePlan();
  const signedIn = status === 'signedIn' && !!profile;

  if (status === 'loading') return <StateView state="loading" />;
  if (status === 'error') return <StateView state="error" onRetry={reloadProfile} />;

  const savedCount = signedIn ? new Set((saves.data ?? []).map((s) => s.vendorId)).size : 0;
  const askedCount = signedIn ? (inquiries.data?.length ?? 0) : 0;
  const initials = (profile?.full_name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, !signedIn && styles.avatarEmpty]}>
          {signedIn ? (
            <AppText variant="title" color="onPrimary">
              {initials}
            </AppText>
          ) : (
            <Icon name="person" size={40} color={Colors.onPrimary} />
          )}
        </View>
        <View style={styles.stats}>
          <Stat
            value={savedCount}
            label={t('profile.stats.saved')}
            onPress={() => router.push('/saved')}
          />
          <Stat
            value={askedCount}
            label={t('profile.stats.asked')}
            onPress={() => (signedIn ? router.push('/my-inquiries') : router.push('/sign-in'))}
          />
          <Stat
            value={bookedCount(plan)}
            label={t('profile.stats.booked')}
            onPress={() => router.push('/plan')}
          />
        </View>
      </View>

      {signedIn && profile ? (
        <View style={styles.who}>
          <AppText variant="heading" weight={700}>
            {profile.full_name}
          </AppText>
          <AppText variant="label" weight={400} color="text2">
            {[profile.city, formatPhone(profile.phone)].join(' · ')}
          </AppText>
          {email && (
            <AppText variant="label" weight={400} color="text2">
              {email}
            </AppText>
          )}
        </View>
      ) : (
        <View style={styles.who}>
          <AppText variant="heading" weight={700}>
            {status === 'needsProfile'
              ? t('profile.account.finishTitle')
              : t('profile.account.signInTitle')}
          </AppText>
          <AppText color="text2">
            {status === 'needsProfile'
              ? t('profile.account.finishBody')
              : t('profile.account.signInBody')}
          </AppText>
        </View>
      )}

      <View style={styles.buttons}>
        {signedIn ? (
          <>
            <Button
              variant="secondary"
              label={t('profile.editShort')}
              onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'edit' } })}
              style={styles.half}
            />
            <Button
              variant="secondary"
              label={t('planner.title')}
              onPress={() => router.push('/plan')}
              style={styles.half}
            />
          </>
        ) : (
          <Button
            icon="mail-outline"
            label={
              status === 'needsProfile' ? t('profile.account.finish') : t('profile.account.signIn')
            }
            onPress={() => router.push('/sign-in')}
            style={styles.full}
          />
        )}
      </View>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      <AppText variant="section" style={styles.tabular}>
        {String(value)}
      </AppText>
      <AppText variant="label" weight={400} color="text2">
        {label}
      </AppText>
    </Pressable>
  );
}

/** The Memory Vaults they're in (their own wedding's, or one they joined as a guest); nothing until then. */
function VaultsSection() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const vaults = useMyVaults();
  if (!vaults.data?.length) return null;
  return (
    <ListSection inset header={t('memoryVault.profileHeader')}>
      {vaults.data.map((vault) => (
        <ListRow
          key={vault.id}
          leading={
            <View style={styles.rowIcon}>
              <VaultIcon size={Sizes.icon} color={Colors.primary} />
            </View>
          }
          title={vault.title ?? t('memoryVault.title')}
          subtitle={t('memoryVault.count', { count: vault.itemCount })}
          onPress={() => router.push({ pathname: '/vault/[id]', params: { id: vault.id } })}
        />
      ))}
    </ListSection>
  );
}

const modeOf = (s: WedState) => s.mode;

/**
 * MOCKUP: Wed's settings, one tap from Profile. Each row opens that page in
 * the Wed tab, with the chat underneath to go back to.
 */
function WedSection() {
  const mode = useWed(modeOf);
  return (
    <ListSection inset header="Wed">
      <ListRow
        icon="book-outline"
        title="What Wed knows"
        onPress={() => router.navigate('/wed/memory')}
      />
      <ListRow
        icon="apps-outline"
        title="Apps Wed can use"
        onPress={() => router.navigate('/wed/apps')}
      />
      <ListRow
        icon="options-outline"
        title="How much Wed does"
        value={mode === 'small' ? 'Do the small things' : 'Ask me first'}
        onPress={() => router.navigate('/wed/settings')}
      />
    </ListSection>
  );
}

/**
 * The saved vendors as a three-column photo grid, like a profile's posts.
 * See all opens Saved, which has them grouped by event.
 */
function SavedGrid() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status } = useSession();
  const saves = useSavedVendors();
  if (status !== 'signedIn') return null;

  const vendors = new Map<string, NonNullable<SavedVendor['vendor']>>();
  for (const save of saves.data ?? []) {
    if (save.vendor && !vendors.has(save.vendorId)) vendors.set(save.vendorId, save.vendor);
  }
  const list = [...vendors.values()];

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('profile.savedGrid')}
        link={list.length > 0 ? t('home.seeAll') : undefined}
        onLink={() => router.navigate('/saved')}
      />
      {list.length === 0 ? (
        <View style={styles.emptyGrid}>
          <Icon name="images-outline" size={36} color={Colors.chevron} />
          <AppText color="text2" style={styles.center}>
            {t('profile.savedGridEmpty')}
          </AppText>
        </View>
      ) : (
        <View style={styles.grid}>
          {list.map((vendor) => (
            <Pressable
              key={vendor.slug}
              accessibilityRole="button"
              accessibilityLabel={localized(vendor.name)}
              onPress={() => router.push(`/v/${vendor.slug}` as Href)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              {vendor.photoUrl ? (
                <Image
                  source={{ uri: vendor.photoUrl }}
                  contentFit="cover"
                  transition={150}
                  accessible={false}
                  style={styles.tileImage}
                />
              ) : (
                <View style={[styles.tileImage, styles.tileEmpty]}>
                  <Icon name="storefront-outline" size={28} color={Colors.primary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  header: {
    gap: Spacing.lg,
  },
  rowIcon: {
    width: Sizes.rowIcon,
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  avatarEmpty: {
    backgroundColor: Colors.textDisabled,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    minWidth: 64,
    paddingVertical: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  who: {
    gap: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  half: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  full: {
    flex: 1,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  block: {
    gap: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    borderRadius: Radius.photo,
    overflow: 'hidden',
  },
  tile: {
    width: '32.8%',
    aspectRatio: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.skeleton,
  },
  tileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  emptyGrid: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  center: {
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
}));
