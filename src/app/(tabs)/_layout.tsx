import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  GlassTabBar,
  TabBarSpaceProvider,
  useTabBarOffset,
  type TabSpec,
} from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useUnreadCount } from '@/data/chat';
import { useSession } from '@/features/auth/session';
import { useOpensInBusiness } from '@/features/business/app-mode';
import { useOnboardingGate } from '@/features/onboarding/gate';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { useWedNavigation } from '@/features/wed/open-wed';
import { WED_BUTTON_SPACE, WedButton } from '@/features/wed/wed-button';
import { useWed, waitingCount } from '@/features/wed/wed-store';
import { useLocale } from '@/i18n/locale-context';

const TABS: (Omit<TabSpec, 'label'> & { labelKey: string })[] = [
  { name: '(home)', labelKey: 'tabs.home', icon: 'home-outline', iconFilled: 'home' },
  {
    name: 'discover',
    labelKey: 'tabs.discover',
    icon: 'play-circle-outline',
    iconFilled: 'play-circle',
  },
  { name: '(search)', labelKey: 'tabs.search', icon: 'search-outline', iconFilled: 'search' },
  {
    name: 'requests',
    labelKey: 'tabs.requests',
    icon: 'megaphone-outline',
    iconFilled: 'megaphone',
  },
  {
    name: 'profile',
    labelKey: 'tabs.profile',
    icon: 'person-circle-outline',
    iconFilled: 'person-circle',
  },
];

/**
 * Bottom tabs: Home, Reels (the discover route), Search, Requests and
 * Profile, in a floating glass bar (the iOS 26 tab bar) that content scrolls
 * under, with Wed's round button floating above its right end (Wed's chat is
 * a tab without a place on the bar; WedButton shows how many of its cards
 * wait for a yes). Saved lives at /saved, over the tabs. Labels are always visible and
 * come from i18n. Expo Router's JS tabs draw it the same on iPhone,
 * Android and the web; the glass itself is the system material on iOS 26.
 */
export default function TabsLayout() {
  const Colors = useColors();
  const { t } = useLocale();
  const offset = useTabBarOffset();
  const unread = useUnreadCount();
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
  const waiting = useWed(waitingCount);
  // Only someone who can say yes gets a count to clear
  const canApprove = useWed((s) => s.role === 'owner');
  useWedNavigation();
  // Unread messages show on Profile, where Messages lives; Wed's button shows
  // how many of its cards wait for the family's OK.
  const okCount = canApprove ? waiting : 0;
  const tabs = TABS.map(({ labelKey, ...tab }) => ({
    ...tab,
    label: t(labelKey),
    badge: tab.name === 'profile' ? unread : undefined,
  }));
  // The first time the app opens: the welcome screen, or the first questions.
  const gate = useOnboardingGate();
  // Business mode has its own tabs (features/business/app-mode.ts)
  const business = useOpensInBusiness();
  if (gate === 'wait' || business === 'wait') {
    return <View style={{ flex: 1, backgroundColor: Colors.canvas }} />;
  }
  if (gate) return <Redirect href={gate} />;
  if (business) return <Redirect href="/today" />;

  return (
    <TabBarSpaceProvider value={Sizes.tabBar + offset + Spacing.sm + WED_BUTTON_SPACE}>
      <Tabs
        key={generation}
        tabBar={(props) => (
          <GlassTabBar {...props} tabs={tabs} floating={<WedButton count={okCount} />} />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
        <Tabs.Screen name="wed" options={{ title: t('tabs.wed') }} />
      </Tabs>
      <SavedToastHost />
    </TabBarSpaceProvider>
  );
}
