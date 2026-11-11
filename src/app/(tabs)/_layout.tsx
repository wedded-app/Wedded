import { Image } from 'expo-image';
import { Redirect, router, Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import type { SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Platform, PlatformColor, View } from 'react-native';

import { RingsIcon } from '@/components/rings-icon';
import {
  TabBar,
  TabBarSpaceProvider,
  useTabBarOffset,
  type TabAction,
  type TabSpec,
} from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useOpensInBusiness } from '@/features/business/app-mode';
import { useOnboardingGate } from '@/features/onboarding/gate';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { openWed } from '@/features/wed/open-wed';
import { useWed, waitingCount } from '@/features/wed/wed-store';
import { useLocale } from '@/i18n/locale-context';

type Tab = Omit<TabSpec, 'label'> & {
  labelKey: string;
  /** iPhone's bar: the SF Symbol, outlined, and filled while the tab is selected. */
  sf?: { default: SFSymbol; selected: SFSymbol };
  /** iPhone's bar: template images, for a tab SF Symbols has nothing for. */
  png?: { default: number; selected: number };
};

const TABS: Tab[] = [
  {
    name: '(home)',
    labelKey: 'tabs.home',
    icon: 'home-outline',
    iconFilled: 'home',
    sf: { default: 'house', selected: 'house.fill' },
  },
  // The (search) stack: Vendors first, with Search, results and Requests on top
  {
    name: '(search)',
    labelKey: 'tabs.vendors',
    icon: 'storefront-outline',
    iconFilled: 'storefront',
    sf: { default: 'storefront', selected: 'storefront.fill' },
  },
  {
    name: 'discover',
    labelKey: 'tabs.discover',
    icon: 'play-circle-outline',
    iconFilled: 'play-circle',
    sf: { default: 'play.circle', selected: 'play.circle.fill' },
  },
  // My Wedding (the plan route): every event, guests, the website, family
  {
    name: 'plan',
    labelKey: 'tabs.wedding',
    icon: 'heart-outline',
    renderIcon: (color, selected) => (
      <RingsIcon size={Sizes.tabIcon} color={color} selected={selected} />
    ),
    // RingsIcon's drawing as 26 pt images (@2x, @3x), thicker when selected
    png: {
      default: require('../../../assets/images/tab-rings.png'),
      selected: require('../../../assets/images/tab-rings-selected.png'),
    },
  },
];

// Wed's place in the middle (src/app/(tabs)/wed-tab.tsx): a tab on iPhone's
// bar that never opens, so its tap can slide Wed up instead
const WED_TAB = 'wed-tab';
// The bow as a 28 x 24 pt template image for iPhone's bar (@2x, @3x), and the
// same cut (ribbon-glyph.png is its @3x) drawn at that size on the others
const WED_ICON = require('../../../assets/images/tab-wed.png');
const WED_GLYPH = require('../../../assets/images/ribbon-glyph.png');

/**
 * Bottom tabs: Home, Vendors (the (search) stack, with Search and Requests on
 * it), Wed in the middle (with how many of its cards wait for a yes), Reels
 * (the discover route) and Wedding (My Wedding, the plan route). Profile
 * opens from Settings on Home (DECISIONS.md, 2026-10-23). Wed isn't a tab:
 * it looks like one, but a tap slides Wed up as a sheet over whichever tab
 * is open (src/app/wed, presented by the root stack), and closing it leaves
 * that tab as it was.
 *
 * On iPhone it's iOS's own tab bar (Expo Router's NativeTabs, DECISIONS.md
 * 2026-11-10): Liquid Glass on iOS 26, and a finger held on the bar slides
 * from tab to tab. Wed's tab is `disabled`, so iOS never selects it but
 * still reports the tap, which opens Wed. Android and the web keep the
 * floating glass bar drawn in JS (TabBar), with Wed drawn like a tab there
 * too.
 */
export default function TabsLayout() {
  const Colors = useColors();
  const { t } = useLocale();
  const offset = useTabBarOffset();
  // Signing out, or someone else signing in, starts every tab fresh, so the
  // next person never lands on the last one's pages. A first sign-in (often
  // mid-action, like Save) keeps them where they were.
  const userId = useSession().session?.user.id ?? null;
  const [seenUser, setSeenUser] = useState(userId);
  const [generation, setGeneration] = useState(0);
  if (seenUser !== userId) {
    setSeenUser(userId);
    if (seenUser !== null) setGeneration((g) => g + 1);
  }
  // Only someone who can say yes gets a count to clear
  const waiting = useWed(waitingCount);
  const canApprove = useWed((s) => s.role === 'owner');
  const wedCount = canApprove ? waiting : 0;
  // Unread messages show on the chat button at the top of Home.
  const tabs = TABS.map((tab) => ({ ...tab, label: t(tab.labelKey) }));
  // The first time the app opens: the welcome screen, or the first questions.
  const gate = useOnboardingGate();
  // Business mode has its own tabs (features/business/app-mode.ts)
  const business = useOpensInBusiness();
  if (gate === 'wait' || business === 'wait') {
    return <View style={{ flex: 1, backgroundColor: Colors.canvas }} />;
  }
  if (gate) return <Redirect href={gate} />;
  if (business) return <Redirect href="/today" />;

  const wedLabel =
    wedCount > 0 ? t('wedButton.waiting', { count: wedCount }) : t('wedButton.label');

  if (Platform.OS === 'ios') {
    return (
      // iOS counts its bar in each tab's safe area, so screens pad by the inset
      <TabBarSpaceProvider value={{ native: true }}>
        <NativeTabs
          key={generation}
          // The selected tab in ink: black, or white in dark mode and over
          // dark pages like Reels, where the glass turns dark by itself
          tintColor={PlatformColor('label')}
          // Always there and always the same size, for people new to phones
          minimizeBehavior="never"
        >
          {tabs.slice(0, 2).map(renderNativeTab)}
          <NativeTabs.Trigger
            name={WED_TAB}
            disabled
            accessibilityLabel={wedLabel}
            listeners={{ tabPress: () => openWed() }}
          >
            <NativeTabs.Trigger.Icon src={WED_ICON} renderingMode="template" />
            <NativeTabs.Trigger.Label>{t('tabs.wed')}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Badge hidden={wedCount === 0}>
              {wedCount > 99 ? '99+' : String(wedCount)}
            </NativeTabs.Trigger.Badge>
          </NativeTabs.Trigger>
          {tabs.slice(2).map(renderNativeTab)}
        </NativeTabs>
        <SavedToastHost />
      </TabBarSpaceProvider>
    );
  }

  const wed: TabAction = {
    label: t('tabs.wed'),
    renderIcon: (color) => (
      <Image
        source={WED_GLYPH}
        tintColor={color}
        contentFit="contain"
        style={{ width: 28, height: 24 }}
        accessible={false}
      />
    ),
    badge: wedCount,
    accessibilityLabel: wedLabel,
    accessibilityHint: t('wedButton.hint'),
    onPress: () => openWed(),
    onLongPress: () => router.push('/wed-voice'),
  };

  return (
    <TabBarSpaceProvider value={{ space: Sizes.tabBar + offset + Spacing.sm }}>
      <Tabs
        key={generation}
        tabBar={(props) => <TabBar {...props} tabs={tabs} action={wed} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
        <Tabs.Screen name={WED_TAB} options={{ href: null }} />
      </Tabs>
      <SavedToastHost />
    </TabBarSpaceProvider>
  );

  function renderNativeTab(tab: (typeof tabs)[number]) {
    return (
      <NativeTabs.Trigger
        key={tab.name}
        name={tab.name}
        // Screens keep placing themselves under the status bar and above the
        // tab bar (useBottomSpace), as they do on Android and the web
        disableAutomaticContentInsets
        contentStyle={{ backgroundColor: Colors.bg }}
      >
        {tab.sf ? (
          <NativeTabs.Trigger.Icon sf={tab.sf} />
        ) : tab.png ? (
          <NativeTabs.Trigger.Icon src={tab.png} renderingMode="template" />
        ) : null}
        <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    );
  }
}
