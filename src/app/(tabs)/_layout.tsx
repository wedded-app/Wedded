import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RingsIcon } from '@/components/rings-icon';
import { TabBar, TabBarSpaceProvider, useTabBarOffset, type TabSpec } from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useOpensInBusiness } from '@/features/business/app-mode';
import { useOnboardingGate } from '@/features/onboarding/gate';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { WedButton } from '@/features/wed/wed-button';
import { useWed, waitingCount } from '@/features/wed/wed-store';
import { useLocale } from '@/i18n/locale-context';

const TABS: (Omit<TabSpec, 'label'> & { labelKey: string })[] = [
  {
    name: '(home)',
    labelKey: 'tabs.home',
    icon: 'home-outline',
    iconFilled: 'home',
  },
  // The (search) stack: Vendors first, with Search, results and Requests on top
  {
    name: '(search)',
    labelKey: 'tabs.vendors',
    icon: 'storefront-outline',
    iconFilled: 'storefront',
  },
  {
    name: 'discover',
    labelKey: 'tabs.discover',
    icon: 'play-circle-outline',
    iconFilled: 'play-circle',
  },
  // My Wedding (the plan route): every event, guests, the website, family
  {
    name: 'plan',
    labelKey: 'tabs.wedding',
    icon: 'heart-outline',
    renderIcon: (color, selected) => (
      <RingsIcon size={Sizes.tabIcon} color={color} selected={selected} />
    ),
  },
];

/**
 * Bottom tabs: Home, Vendors (the (search) stack, with Search and Requests on
 * it), Wed's bow in the middle (WedButton, with how many of its cards wait
 * for a yes), Reels (the discover route) and Wedding (My Wedding, the plan
 * route), in a floating glass bar that content scrolls under (TabBar: each
 * tab's icon over its name, a lens behind the selected one). Profile opens
 * from your photo on Home (DECISIONS.md, 2026-10-23). Wed isn't a tab: its
 * button slides Wed up as a sheet over whichever tab is open (src/app/wed,
 * presented by the root stack), and closing it leaves that tab as it was.
 * Expo Router's JS tabs draw it the same on iPhone, Android and the web.
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
  // Unread messages show on the chat button at the top of Home.
  const tabs = TABS.map(({ labelKey, ...tab }) => ({ ...tab, label: t(labelKey) }));
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
    <TabBarSpaceProvider value={Sizes.tabBar + offset + Spacing.sm}>
      <Tabs
        key={generation}
        tabBar={(props) => (
          <TabBar {...props} tabs={tabs} center={<WedButton count={canApprove ? waiting : 0} />} />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
      <SavedToastHost />
    </TabBarSpaceProvider>
  );
}
