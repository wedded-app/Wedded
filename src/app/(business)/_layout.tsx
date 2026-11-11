import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { AppTabs } from '@/components/app-tabs';
import type { TabAction, TabSpec } from '@/components/tab-bar';
import { useColors } from '@/constants/theme';
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
    sf: { default: 'sun.max', selected: 'sun.max.fill' },
  },
  {
    name: 'leads',
    labelKey: 'businessMode.tabs.leads',
    icon: 'people-outline',
    iconFilled: 'people',
    sf: { default: 'person.2', selected: 'person.2.fill' },
  },
  {
    name: 'calendar',
    labelKey: 'businessMode.tabs.calendar',
    icon: 'calendar-outline',
    iconFilled: 'calendar',
    sf: { default: 'calendar', selected: 'calendar' },
  },
  {
    name: 'business',
    labelKey: 'businessMode.tabs.business',
    icon: 'storefront-outline',
    iconFilled: 'storefront',
    sf: { default: 'storefront', selected: 'storefront.fill' },
  },
];

// The bow, as on the planning side's bar (src/app/(tabs)/_layout.tsx)
const WED_ICON = require('../../../assets/images/tab-wed.png');
const WED_GLYPH = require('../../../assets/images/ribbon-glyph.png');

/**
 * Business mode's tabs (#252, features/business/app-mode.ts): Today (what
 * needs them now), Leads (the families who asked, and Wanted inside it), Wed
 * in the middle, Calendar and My page (a live preview, photos, packages,
 * reels, tools, Pro), in the same bar as the planning tabs (AppTabs: iOS's
 * own on iPhone, DECISIONS.md 2026-11-10) but with saffron for the selected
 * tab. Leads and Wed show how many families wait for a reply; Wed opens its
 * sheet for the business (/business/wed), and its place in the bar is the
 * empty route business-wed.tsx. Reels opens from My page (/business/reels).
 * Messages are the chat button at the top right of every tab. Signed out,
 * or no longer running a business, goes back to the planning side.
 */
export default function BusinessTabsLayout() {
  const Colors = useColors();
  const { t } = useLocale();
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
  const wed: TabAction = {
    route: 'business-wed',
    label: t('businessWed.button'),
    renderIcon: (color) => (
      <Image
        source={WED_GLYPH}
        tintColor={color}
        contentFit="contain"
        style={{ width: 28, height: 24 }}
        accessible={false}
      />
    ),
    png: WED_ICON,
    badge: waiting,
    accessibilityLabel:
      waiting > 0 ? t('businessWed.buttonWaiting', { count: waiting }) : t('businessWed.button'),
    onPress: () => router.push('/business/wed'),
  };

  return <AppTabs tabs={tabs} action={wed} accent="kesari" />;
}
