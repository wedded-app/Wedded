import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { Spacing, useColors } from '@/constants/theme';
import { siteProblem, useSitePage, type SiteLock } from '@/data/website';
import { siteDesign, sitePalette } from '@/features/website/designs';
import { useSiteFonts } from '@/features/website/fonts';
import { SiteButton, SiteView } from '@/features/website/site-view';
import { useLocale } from '@/i18n/locale-context';

/**
 * A family's wedding website, /w/{slug}: what guests open from the link on
 * their invitation or in a WhatsApp group. No account and no app needed.
 * With ?g={their RSVP token} a guest sees only their own events. A site with
 * a password asks for it first; the family's own people skip it.
 */
export default function WeddingSiteScreen() {
  const { t } = useLocale();
  const Colors = useColors();
  // The hook, not the module-level router: this reads it while rendering
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug = '', g } = useLocalSearchParams<{ slug: string; g?: string }>();
  const [password, setPassword] = useState('');
  const page = useSitePage(slug, { password, guestToken: g });
  const fontsReady = useSiteFonts();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const back = router.canGoBack() ? (
    <View style={[styles.back, { top: insets.top + Spacing.sm }]}>
      <GlassButton
        icon="chevron-back"
        accessibilityLabel={t('website.back')}
        onPress={() => router.back()}
      />
    </View>
  ) : null;

  let body;
  let head = <title>{t('website.pageTitlePlain')}</title>;
  let dark = false;
  if (page.isPending || !fontsReady || width === 0) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.text2} />
      </View>
    );
  } else if (page.isError || !page.data) {
    const problem = page.isError ? siteProblem(page.error) : 'notFound';
    body = (
      <View style={[styles.center, styles.gap]}>
        <Icon
          name={problem === 'notFound' ? 'link-outline' : 'cloud-offline-outline'}
          size={36}
          color={Colors.text2}
        />
        <AppText variant="heading" style={styles.centerText}>
          {problem === 'notFound'
            ? t('website.missing.title')
            : problem === 'passwordLimit'
              ? t('website.password.limit')
              : t('states.error')}
        </AppText>
        {problem === 'notFound' ? (
          <AppText color="text2" style={styles.centerText}>
            {t('website.missing.body')}
          </AppText>
        ) : (
          <Button
            variant="secondary"
            label={t('states.tryAgain')}
            onPress={() => void page.refetch()}
          />
        )}
      </View>
    );
  } else if (page.data.kind === 'locked') {
    const lock = page.data.lock;
    dark = siteDesign(lock.design).cover === 'stars';
    head = <title>{t('website.pageTitle', { names: lock.title })}</title>;
    body = <PasswordGate lock={lock} width={width} onSubmit={setPassword} />;
  } else {
    const site = page.data.page;
    dark = siteDesign(site.design).cover === 'stars';
    head = (
      <>
        <title>{t('website.pageTitle', { names: site.title })}</title>
        <meta name="description" content={t('website.pageDescription')} />
        {site.searchable ? null : <meta name="robots" content="noindex" />}
      </>
    );
    body = (
      <ScrollView
        style={{ backgroundColor: sitePalette(siteDesign(site.design), site.palette).paper }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <SiteView page={site} width={width} topInset={insets.top} editing={!!site.editor} />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: Colors.bg }]} onLayout={onLayout}>
      <Head>{head}</Head>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {body}
      {back}
    </View>
  );
}

/** The couple's names in their design, and a box for the site's password. */
function PasswordGate({
  lock,
  width,
  onSubmit,
}: {
  lock: SiteLock;
  width: number;
  onSubmit: (password: string) => void;
}) {
  const { t } = useLocale();
  const design = siteDesign(lock.design);
  const palette = sitePalette(design, lock.palette);
  const look = { design, palette };
  const type = useTypeStyle({ variant: 'bodyLg' });
  const [typed, setTyped] = useState('');
  const names = 38 * design.namesScale;
  return (
    <View style={[styles.gate, { backgroundColor: palette.paper, width }]}>
      <Text
        maxFontSizeMultiplier={1.3}
        accessibilityRole="header"
        style={{
          fontFamily: design.namesFont,
          fontSize: names,
          lineHeight: names * 1.3,
          color: palette.ink,
          textAlign: 'center',
        }}
      >
        {lock.title}
      </Text>
      <AppText style={[styles.centerText, { color: palette.soft }]}>
        {lock.locked === 'wrong_password' ? t('website.password.wrong') : t('website.password.ask')}
      </AppText>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={() => onSubmit(typed)}
        placeholder={t('website.password.label')}
        placeholderTextColor={palette.soft}
        accessibilityLabel={t('website.password.label')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        maxFontSizeMultiplier={type.maxFontSizeMultiplier}
        style={[
          styles.input,
          {
            fontFamily: type.fontFamily,
            fontSize: type.fontSize,
            color: palette.ink,
            borderColor: palette.soft,
            backgroundColor: palette.card,
          },
        ]}
      />
      <SiteButton look={look} label={t('website.password.open')} onPress={() => onSubmit(typed)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  gap: {
    gap: Spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  back: {
    position: 'absolute',
    left: Spacing.lg,
  },
  gate: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
  },
});
