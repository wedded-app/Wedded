import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import {
  GlassTabBar,
  TabBarSpaceProvider,
  useTabBarOffset,
  type TabSpec,
} from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useBusinessLeads, waitingCount } from '@/data/business';
import { useSession } from '@/features/auth/session';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';

const TABS: (Omit<TabSpec, 'label'> & { labelKey: string })[] = [
  {
    name: 'today',
    labelKey: 'businessMode.tabs.today',
    icon: 'sunny-outline',
    iconFilled: 'sunny',
  },
  {
    name: 'wanted',
    labelKey: 'businessMode.tabs.wanted',
    icon: 'megaphone-outline',
    iconFilled: 'megaphone',
  },
  {
    name: 'reels',
    labelKey: 'businessMode.tabs.reels',
    icon: 'play-circle-outline',
    iconFilled: 'play-circle',
  },
  {
    name: 'leads',
    labelKey: 'businessMode.tabs.leads',
    icon: 'people-outline',
    iconFilled: 'people',
  },
  {
    name: 'business',
    labelKey: 'businessMode.tabs.business',
    icon: 'storefront-outline',
    iconFilled: 'storefront',
  },
];

/**
 * Business mode's tabs (#252, features/business/app-mode.ts): Today, Wanted
 * (families' requests, Threads style), Reels, Leads (the families who asked
 * them) and Business (numbers, page, calendar, settings), in the same glass
 * bar as the planning tabs but with saffron for the selected tab. Leads shows
 * how many families wait for a reply. Messages are the chat button at the top
 * right of every tab. Signed out, or no longer running a business, goes back
 * to the planning side.
 */
export default function BusinessTabsLayout() {
  const Colors = useColors();
  const { t } = useLocale();
  const offset = useTabBarOffset();
  const { status } = useSession();
  const current = useCurrentBusiness();
  const leads = useBusinessLeads(current.vendorId);

  if (status === 'loading' || (status === 'signedIn' && current.isPending)) {
    return <View style={{ flex: 1, backgroundColor: Colors.canvas }} />;
  }
  if (!current.business) return <Redirect href="/" />;

  const waiting = waitingCount(leads.data ?? []);
  const tabs = TABS.map(({ labelKey, ...tab }) => ({
    ...tab,
    label: t(labelKey),
    badge: tab.name === 'leads' ? waiting : undefined,
  }));

  return (
    <TabBarSpaceProvider value={Sizes.tabBar + offset + Spacing.sm}>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} tabs={tabs} accent="kesari" />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
    </TabBarSpaceProvider>
  );
}
