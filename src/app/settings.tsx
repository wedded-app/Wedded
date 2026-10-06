import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { Switch } from '@/components/switch';
import { makeStyles, Palettes, Spacing, useColors, type Scheme } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useSearchLocation } from '@/features/location/search-location';
import { resetOnboarding } from '@/features/onboarding/onboarding-state';
import { TEXT_SIZES, useSettings, type TextSize } from '@/features/settings/settings';
import type { Locale } from '@/i18n';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const LANGUAGES: { locale: Locale; labelKey: string }[] = [
  { locale: 'en', labelKey: 'profile.english' },
  { locale: 'pa', labelKey: 'profile.punjabi' },
];

/**
 * Settings (vision S16), laid out like the iPhone's own: appearance with
 * light and dark previews, text size, language, haptics, where to search,
 * then about and account. Everything is saved on this phone.
 */
export default function SettingsScreen() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale, setLocale } = useLocale();
  const settings = useSettings();
  const { place, maxMiles, openLocationSheet } = useSearchLocation();
  const { status, signOut } = useSession();
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

      <ListSection header={t('profile.language')}>
        {LANGUAGES.map((language) => (
          <ListRow
            key={language.locale}
            title={t(language.labelKey)}
            titleLang={language.locale}
            accessibilityRole="radio"
            checked={language.locale === locale}
            onPress={() => {
              if (language.locale !== locale) selectionHaptic();
              setLocale(language.locale);
            }}
          />
        ))}
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
        <ListRow
          icon="notifications-outline"
          title={t('settings.notifications')}
          value={t('common.comingSoon')}
        />
      </ListSection>

      <ListSection inset header={t('settings.planning')}>
        <ListRow
          icon="checkbox-outline"
          title={t('planner.title')}
          onPress={() => router.push('/plan')}
        />
      </ListSection>

      <ListSection inset header={t('settings.about')}>
        <ListRow
          icon="ribbon-outline"
          iconColor="kesari"
          title={t('home.foundingWall')}
          onPress={() => router.push('/founding')}
        />
        <ListRow
          icon="storefront-outline"
          title={t('home.forVendors')}
          onPress={() => router.push('/for-vendors')}
        />
        <ListRow icon="information-circle-outline" title={t('settings.version')} value={version} />
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
