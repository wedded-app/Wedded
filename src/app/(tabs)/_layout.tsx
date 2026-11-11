import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppTabs } from '@/components/app-tabs';
import { RingsIcon } from '@/components/rings-icon';
import type { TabAction, TabSpec } from '@/components/tab-bar';
import { Sizes, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useOpensInBusiness } from '@/features/business/app-mode';
import { useOnboardingGate } from '@/features/onboarding/gate';
import { SavedToastHost } from '@/features/saved/saved-toast';
import { openWed } from '@/features/wed/open-wed';
import { useWed, waitingCount } from '@/features/wed/wed-store';
import { useLocale } from '@/i18n/locale-context';

const TABS: (Omit<TabSpec, 'label'> & { labelKey: string })[] = [
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

// The bow: a 28 x 24 pt template image for iPhone's bar (@2x, @3x), and the
// same cut (ribbon-glyph.png is its @3x) drawn at that size on the others
const WED_ICON = require('../../../assets/images/tab-wed.png');
const WED_GLYPH = require('../../../assets/images/ribbon-glyph.png');

/**
 * The planning tabs (AppTabs: iOS's own bar on iPhone, one drawn to match
 * it elsewhere): Home, Vendors (the (search) stack, with Search and Requests
 * on it), Wed in the middle (with how many of its cards wait for a yes),
 * Reels (the discover route) and Wedding (My Wedding, the plan route).
 * Profile opens from Settings on Home (DECISIONS.md, 2026-10-23). Wed isn't
 * a tab: it looks like one, but a tap slides Wed up as a sheet over
 * whichever tab is open (src/app/wed, presented by the root stack), and
 * closing it leaves that tab as it was. Its place in the bar is the empty
 * route wed-tab.tsx.
 */
export default function TabsLayout() {
  const Colors = useColors();
  const { t } = useLocale();
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

  const wed: TabAction = {
    route: 'wed-tab',
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
    png: WED_ICON,
    badge: wedCount,
    accessibilityLabel:
      wedCount > 0 ? t('wedButton.waiting', { count: wedCount }) : t('wedButton.label'),
    onPress: () => openWed(),
  };

  return (
    <AppTabs key={generation} tabs={tabs} action={wed}>
      <SavedToastHost />
    </AppTabs>
  );
}
