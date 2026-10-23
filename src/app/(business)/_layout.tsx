import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { TabBar, TabBarSpaceProvider, useTabBarOffset, type TabSpec } from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useBusinessLeads, waitingCount } from '@/data/business';
import { useSession } from '@/features/auth/session';
import { BusinessWedButton } from '@/features/business/business-wed-button';
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
    name: 'leads',
    labelKey: 'businessMode.tabs.leads',
    icon: 'people-outline',
    iconFilled: 'people',
  },
  {
    name: 'calendar',
    labelKey: 'businessMode.tabs.calendar',
    icon: 'calendar-outline',
    iconFilled: 'calendar',
  },
  {
    name: 'business',
    labelKey: 'businessMode.tabs.business',
    icon: 'storefront-outline',
    iconFilled: 'storefront',
  },
];

/**
 * Business mode's tabs (#252, features/business/app-mode.ts; the final look,
 * 2026-10-23): Today (what needs them now), Leads (the families who asked,
 * and Wanted inside it), Wed's bow in the middle, Calendar and My page (a
 * live preview, photos, packages, reels, tools, Pro), in the same glass bar
 * as the planning tabs but with saffron for the selected tab. Leads and the
 * bow show how many families wait for a reply. Wanted and Reels stay as
 * routes off the bar. Messages are the chat button at the top right of every
 * tab. Signed out, or no longer running a business, goes back to the
 * planning side.
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
        tabBar={(props) => (
          <TabBar
            {...props}
            tabs={tabs}
            accent="kesari"
            center={<BusinessWedButton count={waiting} />}
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
        <Tabs.Screen name="wanted" options={{ href: null }} />
        <Tabs.Screen name="reels" options={{ href: null }} />
      </Tabs>
    </TabBarSpaceProvider>
  );
}
