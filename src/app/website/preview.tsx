import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { GlassButton } from '@/components/glass-button';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { shareInvite } from '@/data/wedding';
import { websiteLink } from '@/data/website';
import { siteDesign, sitePalette } from '@/features/website/designs';
import { useSiteFonts } from '@/features/website/fonts';
import { SiteView } from '@/features/website/site-view';
import { useWebsite } from '@/features/website/use-website';
import { closeWebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';

/**
 * Preview and edit: the whole site as guests will see it, with a bar along
 * the bottom to change the design or the photo, go back to the parts, or
 * share it.
 */
export default function WebsitePreviewScreen() {
  const { t } = useLocale();
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const website = useWebsite();
  const fontsReady = useSiteFonts();
  const [width, setWidth] = useState(0);

  if (website.status !== 'ready' || !fontsReady) {
    return (
      <View style={[styles.fill, { backgroundColor: Colors.bg, paddingTop: insets.top }]}>
        {website.status === 'error' ? (
          <StateView state="error" onRetry={website.retry} />
        ) : (
          <StateView state="loading" />
        )}
      </View>
    );
  }
  const site = website.site;
  const design = siteDesign(site.design);
  const palette = sitePalette(design, site.palette);
  const share = () =>
    void shareInvite(
      websiteLink(site.slug),
      (key, o) => t(key, { ...o, names: site.title }),
      'website.shareMessage',
    );
  const tools = [
    {
      icon: 'color-palette-outline' as const,
      label: t('website.tools.design'),
      onPress: () => router.push('/website/design'),
    },
    {
      icon: 'image-outline' as const,
      label: t('website.tools.photo'),
      onPress: () => router.push('/website/cover'),
    },
    { icon: 'list-outline' as const, label: t('website.tools.parts'), onPress: closeWebsiteSheet },
    { icon: 'share-outline' as const, label: t('website.tools.share'), onPress: share },
  ];

  return (
    <View
      style={[styles.fill, { backgroundColor: palette.paper }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      <StatusBar style={design.cover === 'stars' ? 'light' : 'dark'} />
      {width > 0 && (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
          <SiteView page={site} width={width} topInset={insets.top} editing />
        </ScrollView>
      )}
      <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
        <GlassButton
          icon="close"
          accessibilityLabel={t('common.close')}
          onPress={closeWebsiteSheet}
        />
      </View>
      {website.canEdit && (
        <Glass style={[styles.tools, { bottom: Math.max(insets.bottom, Spacing.md) }]}>
          {tools.map((tool) => (
            <Pressable
              key={tool.label}
              accessibilityRole="button"
              accessibilityLabel={tool.label}
              onPress={tool.onPress}
              style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
            >
              <Icon name={tool.icon} size={22} color={Colors.text} />
              <AppText variant="caption" weight={600}>
                {tool.label}
              </AppText>
            </Pressable>
          ))}
        </Glass>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    right: Sizes.pageGutter,
  },
  tools: {
    position: 'absolute',
    left: Sizes.pageGutter,
    right: Sizes.pageGutter,
    flexDirection: 'row',
    borderRadius: 999,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  tool: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.6,
  },
});
