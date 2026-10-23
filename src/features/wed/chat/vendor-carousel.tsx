import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { SITE_URL_IS_PLACEHOLDER, siteLink } from '@/constants/links';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { showSavedToast } from '@/features/saved/saved-toast-store';
import { saveHaptic } from '@/lib/haptics';

import type { FoundPage, MockVendor } from '../mock';
import { openFromWed } from '../open-wed';
import { useWed, wed } from '../wed-store';

// The toast's See list: Wed's lists, where the Jaago list is
const WED_LISTS = '/wed/library' as Href;

const CARD = 240;
const PHOTO = CARD * 0.75;

/**
 * What Wed found, as cards to swipe through: vendors on Wedded first (a 4:3
 * photo with a heart, the name, then "$350 · free Jun 12 · 2 mi"), each
 * opening its page, then pages Wed found on the web that aren't on Wedded
 * ("@punjabibeats_916"), which can be opened or told about Wedded. Under
 * them, when Wed last checked. MOCKUP: the heart saves to Wed's Jaago list
 * (in the Wed store, shown in Lists and photos), not to the account.
 */
export function VendorCarousel({
  vendors,
  found = [],
  checked,
}: {
  vendors: MockVendor[];
  found?: FoundPage[];
  checked: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD + Spacing.md}
        decelerationRate="fast"
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {vendors.map((vendor) => (
          <VendorCard key={vendor.slug} vendor={vendor} />
        ))}
        {found.map((page) => (
          <FoundCard key={page.handle} page={page} />
        ))}
      </ScrollView>
      <AppText variant="label" weight={400} color="text2">
        {checked}
      </AppText>
    </View>
  );
}

function VendorCard({ vendor }: { vendor: MockVendor }) {
  const Colors = useColors();
  const styles = useStyles();
  const saved = useWed((s) => s.saved.includes(vendor.slug));
  const facts = [vendor.price, vendor.fit ?? vendor.city].filter(Boolean).join(' · ');
  const save = () => {
    saveHaptic();
    wed.toggleSaved(vendor.slug);
    if (!saved) showSavedToast('Jaago', WED_LISTS);
  };
  const saveLabel = saved
    ? `Remove ${vendor.name} from your Jaago list`
    : `Save ${vendor.name} to your Jaago list`;

  return (
    <View style={styles.card}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${vendor.name}, ${facts}`}
        accessibilityActions={[{ name: 'toggleSave', label: saveLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'toggleSave') save();
        }}
        // Wed slides down and the vendor's page opens on the tab underneath
        onPress={() => openFromWed({ pathname: '/v/[slug]', params: { slug: vendor.slug } })}
        style={styles.press}
      >
        <Image
          source={{ uri: vendor.photo }}
          placeholder={{ blurhash: vendor.blurhash }}
          contentFit="cover"
          transition={250}
          accessible={false}
          style={styles.photo}
        />
        <View style={styles.words}>
          <AppText weight={600} numberOfLines={1}>
            {vendor.name}
          </AppText>
          <AppText color="text2" numberOfLines={2}>
            {facts}
          </AppText>
        </View>
      </PressableScale>
      <View style={styles.heart}>
        <GlassButton
          icon={saved ? 'heart' : 'heart-outline'}
          color={saved ? Colors.primary : Colors.text}
          accessibilityLabel={saveLabel}
          onPress={save}
        />
      </View>
    </View>
  );
}

/**
 * A page Wed found on the web: where it is and a link to it, never its
 * pictures. As tall as a vendor card, so the row stays even.
 */
function FoundCard({ page }: { page: FoundPage }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.found]}>
      <View style={styles.foundHead}>
        <Icon name="globe-outline" size={28} color={Colors.text2} />
        <AppText variant="label" weight={400} color="text2" style={styles.grow}>
          Found on the web
        </AppText>
      </View>
      <View style={styles.words}>
        <AppText weight={600} numberOfLines={1}>
          {page.handle}
        </AppText>
        <AppText color="text2" numberOfLines={1}>
          {page.detail}
        </AppText>
      </View>
      <View style={styles.grow} />
      <View style={styles.actions}>
        <Button
          label="Open Instagram"
          variant="neutral"
          accessibilityLabel={`Open ${page.handle} on Instagram`}
          onPress={() => void Linking.openURL(page.url).catch(() => {})}
        />
        <Button
          label="Share Wedded"
          variant="plain"
          accessibilityLabel={`Tell ${page.handle} about Wedded`}
          style={styles.slim}
          onPress={() => void tellAboutWedded(page.handle)}
        />
      </View>
    </View>
  );
}

// The family's own share sheet, so the words come from them, not from Wed.
// Browsers without one copy the words instead.
async function tellAboutWedded(handle: string) {
  const link = SITE_URL_IS_PLACEHOLDER ? null : siteLink('/for-vendors');
  const line = `Hi ${handle}! We found you while planning our wedding. Families like ours find vendors on Wedded, and listing your business there is free.`;
  const message = link ? `${line}\n${link}` : line;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
    try {
      await navigator.clipboard.writeText(message);
      globalThis.alert('Copied. Paste it in a message to them.');
    } catch {
      // Nothing to share with; nothing changes
    }
    return;
  }
  try {
    await Share.share({ message });
  } catch {
    // Dismissed or unavailable
  }
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.sm,
  },
  // Edge to edge, so cards slide in from the side of the screen
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  // Every card as tall as the tallest, so the row's bottom edge is even
  track: {
    gap: Spacing.md,
    paddingHorizontal: Sizes.pageGutter,
    alignItems: 'stretch',
  },
  card: {
    width: CARD,
    gap: Spacing.sm,
  },
  press: {
    gap: Spacing.sm,
  },
  photo: {
    width: CARD,
    height: PHOTO,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
  found: {
    // A vendor card's photo, gap and two lines of words
    minHeight: PHOTO + Spacing.sm + 46,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
  },
  foundHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
  words: {
    gap: 2,
  },
  actions: {
    gap: Spacing.xs,
  },
  // A link-style button needs less height than a filled one: 48, to tap
  slim: {
    minHeight: Sizes.tapTarget,
    paddingVertical: Spacing.sm,
  },
  heart: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
}));
