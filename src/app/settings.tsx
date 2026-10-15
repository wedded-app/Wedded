import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { type LegalPage, openLegalPage } from '@/components/legal-line';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { Switch } from '@/components/switch';
import { SITE_URL_IS_PLACEHOLDER } from '@/constants/links';
import { makeStyles, Palettes, Spacing, useColors, type Scheme } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { useSession } from '@/features/auth/session';
import { usePlan } from '@/features/planner/plan';
import { useEnablePush, usePushStatus } from '@/features/chat/push-ask';
import { useSearchLocation } from '@/features/location/search-location';
import { resetOnboarding } from '@/features/onboarding/onboarding-state';
import { TEXT_SIZES, useSettings, type TextSize } from '@/features/settings/settings';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const LEGAL_PAGES: { page: LegalPage; icon: IconName }[] = [
  { page: 'terms', icon: 'reader-outline' },
  { page: 'privacy', icon: 'lock-closed-outline' },
  { page: 'refunds', icon: 'arrow-undo-outline' },
];

/**
 * Settings (vision S16), laid out like the iPhone's own: appearance with
 * light and dark previews, text size, haptics, where to search,
 * then about, the legal pages and licences, and account. Everything is saved on this phone.
 */
export default function SettingsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const settings = useSettings();
  const { place, maxMiles, openLocationSheet } = useSearchLocation();
  const { status, signOut } = useSession();
  const { isVendor } = useIsVendor();
  const planning = !!usePlan().syncedWeddingId;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const pickScheme = (scheme: Scheme) => {
    if (settings.appearance !== scheme) selectionHaptic();
    settings.setAppearance(scheme);
  };

  let searchArea = t('settings.notSet');
  if (place) {
    searchArea =
      maxMiles === null
        ? place.label
        : t('settings.searchAreaValue', { place: place.label, miles: maxMiles });
  }

  return (
    <NavScreen title={t('settings.title')}>
      <ListSection header={t('settings.appearance')}>
        <View style={styles.previews} accessibilityRole="radiogroup">
          {(['light', 'dark'] as const).map((scheme) => (
            <SchemePreview
              key={scheme}
              scheme={scheme}
              label={t(`settings.${scheme}`)}
              selected={settings.scheme === scheme}
              onPress={() => pickScheme(scheme)}
            />
          ))}
        </View>
        <ListRow
          title={t('settings.automatic')}
          subtitle={t('settings.automaticHint')}
          trailing={
            <Switch
              value={settings.appearance === 'system'}
              onValueChange={(on) => settings.setAppearance(on ? 'system' : settings.scheme)}
              accessibilityLabel={t('settings.automatic')}
            />
          }
        />
      </ListSection>

      <ListSection header={t('settings.textSize')} footer={t('settings.textSizeHint')}>
        <View style={styles.textSize}>
          <Segmented<TextSize>
            accessibilityLabel={t('settings.textSize')}
            value={settings.textSize}
            onChange={settings.setTextSize}
            options={TEXT_SIZES.map((size) => ({
              value: size,
              label: t(`settings.textSizes.${size}`),
            }))}
          />
          <AppText>{t('settings.textSample')}</AppText>
        </View>
      </ListSection>

      <ListSection inset header={t('settings.general')}>
        <ListRow
          icon="hand-left-outline"
          title={t('settings.haptics')}
          subtitle={t('settings.hapticsHint')}
          trailing={
            <Switch
              value={settings.haptics}
              onValueChange={settings.setHaptics}
              accessibilityLabel={t('settings.haptics')}
            />
          }
        />
        <ListRow
          icon="location-outline"
          title={t('settings.searchArea')}
          value={searchArea}
          onPress={openLocationSheet}
        />
        <MessageAlertsRow />
      </ListSection>

      {/* Vendor accounts see this only once they're planning a wedding too */}
      {(!isVendor || planning) && (
        <ListSection inset header={t('settings.planning')}>
          <ListRow
            icon="checkbox-outline"
            title={t('planner.title')}
            onPress={() => router.push('/plan')}
          />
        </ListSection>
      )}

      <ListSection inset header={t('settings.about')}>
        <ListRow
          icon="ribbon-outline"
          iconColor="kesari"
          title={t('home.foundingWall')}
          onPress={() => router.push('/founding')}
        />
        {!isVendor && (
          <ListRow
            icon="storefront-outline"
            title={t('home.forVendors')}
            onPress={() => router.push('/for-vendors')}
          />
        )}
        <ListRow icon="information-circle-outline" title={t('settings.version')} value={version} />
      </ListSection>

      <ListSection
        inset
        header={t('settings.legal')}
        footer={SITE_URL_IS_PLACEHOLDER ? t('settings.legalSoon') : undefined}
      >
        {LEGAL_PAGES.map((page) => (
          <ListRow
            key={page.page}
            icon={page.icon}
            title={t(`settings.legalPages.${page.page}`)}
            // Until the website is up there's nothing to open yet.
            value={SITE_URL_IS_PLACEHOLDER ? t('settings.soon') : undefined}
            onPress={SITE_URL_IS_PLACEHOLDER ? undefined : () => openLegalPage(page.page)}
          />
        ))}
        <ListRow
          icon="document-text-outline"
          title={t('licences.title')}
          onPress={() => router.push('/licences')}
        />
      </ListSection>

      {status === 'signedIn' ? (
        <ListSection header={t('settings.account')}>
          <ListRow
            title={t('profile.account.edit')}
            onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'edit' } })}
          />
          <ListRow title={t('profile.account.signOut')} tone="primary" onPress={signOut} />
          <ListRow
            title={t('profile.account.deleteAccount')}
            tone="error"
            onPress={() => router.push('/delete-account')}
          />
        </ListSection>
      ) : (
        <ListSection header={t('settings.account')}>
          <ListRow
            title={t('profile.account.signIn')}
            tone="primary"
            onPress={() => router.push('/sign-in')}
          />
        </ListSection>
      )}

      {__DEV__ && (
        // Expo Go and development builds only, so it's never in the store app (English only).
        <ListSection inset header="Testing" footer="Signs you out first if you're signed in.">
          <ListRow
            icon="refresh-outline"
            title="Show the welcome screen again"
            onPress={async () => {
              resetOnboarding();
              if (status !== 'signedOut') await signOut();
              if (router.canDismiss()) router.dismissAll();
              router.replace('/');
            }}
          />
        </ListSection>
      )}

      <View style={styles.footer}>
        <Icon name="heart" size={16} color={Colors.primary} />
        <AppText variant="caption" color="text2" style={styles.center}>
          {t('settings.madeIn')}
        </AppText>
      </View>
    </NavScreen>
  );
}

/**
 * A little phone drawn in one scheme's colours, like iOS Settings > Display:
 * a title bar, two rows and a tab bar, with a round check under it.
 */

/**
 * Message alerts: on, off, or not possible on this phone (the web, Expo Go
 * on Android). Off and never asked turns them on (the phone asks); once
 * refused, or to turn them off, it opens the phone's Settings.
 */
function MessageAlertsRow() {
  const { t } = useLocale();
  const status = usePushStatus();
  const { enable, busy } = useEnablePush();
  const state = status.data;
  const value =
    state === 'granted'
      ? t('chat.alerts.rowOn')
      : state === 'unavailable'
        ? t('chat.alerts.rowUnavailable')
        : t('chat.alerts.rowOff');
  const onPress =
    state === 'undetermined'
      ? enable
      : state === 'granted' || state === 'denied'
        ? () => void Linking.openSettings()
        : undefined;
  return (
    <ListRow
      icon="notifications-outline"
      title={t('chat.alerts.row')}
      subtitle={
        state === 'denied'
          ? t('chat.alerts.rowDeniedHint')
          : state === 'granted'
            ? t('chat.alerts.rowOnHint')
            : state === 'undetermined'
              ? t('chat.alerts.rowOffHint')
              : undefined
      }
      value={busy ? '…' : value}
      onPress={onPress}
      chevron={!!onPress}
    />
  );
}

function SchemePreview({
  scheme,
  label,
  selected,
  onPress,
}: {
  scheme: Scheme;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const p = Palettes[scheme];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.preview}
    >
      <View
        style={[
          styles.phone,
          { backgroundColor: p.bg, borderColor: selected ? Colors.primary : Colors.separator },
        ]}
      >
        <View style={[styles.bar, { backgroundColor: p.text, width: '55%' }]} />
        <View style={[styles.card, { backgroundColor: p.surface }]}>
          <View style={[styles.line, { backgroundColor: p.primary, width: '40%' }]} />
          <View style={[styles.line, { backgroundColor: p.textDisabled, width: '70%' }]} />
        </View>
        <View style={[styles.card, { backgroundColor: p.surface }]}>
          <View style={[styles.line, { backgroundColor: p.textDisabled, width: '60%' }]} />
          <View style={[styles.line, { backgroundColor: p.textDisabled, width: '45%' }]} />
        </View>
        <View style={[styles.tabs, { backgroundColor: p.glassFallback }]} />
      </View>
      <AppText weight={selected ? 600 : 400}>{label}</AppText>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <Icon name="checkmark" size={15} color={Colors.onPrimary} weight="bold" />}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  previews: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  preview: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  phone: {
    width: 78,
    height: 150,
    padding: 7,
    gap: 6,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2,
    overflow: 'hidden',
  },
  bar: {
    height: 7,
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 2,
  },
  card: {
    gap: 5,
    padding: 6,
    borderRadius: 7,
  },
  line: {
    height: 5,
    borderRadius: 3,
  },
  tabs: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 7,
    height: 14,
    borderRadius: 7,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  textSize: {
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
}));
