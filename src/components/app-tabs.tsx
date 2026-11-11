import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import type { ReactNode } from 'react';
import { Platform, PlatformColor } from 'react-native';

import {
  TabBar,
  TabBarSpaceProvider,
  useTabBarOffset,
  type TabAction,
  type TabSpec,
} from '@/components/tab-bar';
import { Sizes, Spacing, useColors } from '@/constants/theme';

const countText = (count?: number) => (count && count > 99 ? '99+' : String(count ?? 0));

/**
 * The app's bottom tabs, on the planning side and in business mode alike
 * (DECISIONS.md 2026-11-10). On iPhone it's iOS's own tab bar (Expo Router's
 * NativeTabs): Liquid Glass on iOS 26 that turns dark by itself over dark
 * pages, and a finger held on it slides from tab to tab. On Android and the
 * web it's TabBar, drawn to look and slide the same. Either way `action`
 * (Wed) sits in the middle like a tab: on iPhone it's a tab marked
 * `disabled`, so iOS never selects it but still reports the tap, and the
 * tap runs `action.onPress`. The selected tab is ink, or saffron in business
 * mode. `children` (a toast host) are drawn over the tabs.
 */
export function AppTabs({
  tabs,
  action,
  accent = 'text',
  children,
}: {
  tabs: TabSpec[];
  action: TabAction;
  accent?: 'text' | 'kesari';
  children?: ReactNode;
}) {
  const Colors = useColors();
  const offset = useTabBarOffset();
  const half = Math.ceil(tabs.length / 2);

  if (Platform.OS === 'ios') {
    const renderTab = (tab: TabSpec) => (
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
        <NativeTabs.Trigger.Badge hidden={!tab.badge}>
          {countText(tab.badge)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    );
    return (
      // iOS counts its bar in each tab's safe area, so screens pad by the inset
      <TabBarSpaceProvider value={{ native: true }}>
        <NativeTabs
          // Ink: black, or white in dark mode and over dark pages like Reels,
          // where the glass turns dark by itself
          tintColor={accent === 'kesari' ? Colors.kesari : PlatformColor('label')}
          // Always there and always the same size, for people new to phones
          minimizeBehavior="never"
        >
          {tabs.slice(0, half).map(renderTab)}
          <NativeTabs.Trigger
            name={action.route}
            disabled
            accessibilityLabel={action.accessibilityLabel}
            listeners={{ tabPress: () => action.onPress() }}
          >
            <NativeTabs.Trigger.Icon src={action.png} renderingMode="template" />
            <NativeTabs.Trigger.Label>{action.label}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Badge hidden={!action.badge}>
              {countText(action.badge)}
            </NativeTabs.Trigger.Badge>
          </NativeTabs.Trigger>
          {tabs.slice(half).map(renderTab)}
        </NativeTabs>
        {children}
      </TabBarSpaceProvider>
    );
  }

  return (
    <TabBarSpaceProvider value={{ space: Sizes.tabBar + offset + Spacing.sm }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} tabs={tabs} action={action} accent={accent} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.bg },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
        <Tabs.Screen name={action.route} options={{ href: null }} />
      </Tabs>
      {children}
    </TabBarSpaceProvider>
  );
}
