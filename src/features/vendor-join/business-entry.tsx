import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { backgroundCss, makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useIsVendor } from '@/data/chat';
import { switchToBusiness } from '@/features/business/app-mode';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const POSTER = require('../../../assets/images/join-business.jpg');
const SHADE =
  'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0) 100%)';

/**
 * The way in for businesses at the top left of the Vendors tab (Fezy,
 * 2026-11-10: it was only in Settings › About), where business mode shows
 * its saffron Business label, and the same size. Someone who already runs a
 * business here switches to that side in one tap; anyone else opens List
 * your business.
 */
export function BusinessButton() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { isVendor } = useIsVendor();
  const scale = useFontScale('label');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isVendor ? t('vendorJoin.entry.switchSpoken') : t('vendorJoin.entry.listSpoken')
      }
      onPress={() => {
        selectionHaptic();
        if (isVendor) switchToBusiness();
        else router.push('/for-vendors');
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Icon
        name={isVendor ? 'swap-horizontal' : 'storefront-outline'}
        size={18 * Math.min(scale, 1.3)}
        color={Colors.text}
      />
      <AppText variant="label" weight={700} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {isVendor ? t('vendorJoin.entry.switch') : t('vendorJoin.entry.list')}
      </AppText>
    </Pressable>
  );
}

/**
 * At the bottom of the Vendors tab, for anyone not running a business here
 * yet: a mehndi artist at work and one line on listing for free.
 */
export function BusinessCard() {
  const styles = useStyles();
  const { t } = useLocale();
  const { isVendor } = useIsVendor();
  if (isVendor) return null;

  const open = () => {
    selectionHaptic();
    router.push('/for-vendors');
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('vendorJoin.entry.cardTitle')} ${t('vendorJoin.entry.cardBody')}`}
      accessibilityHint={t('vendorJoin.entry.cardButton')}
      pressedScale={0.98}
      onPress={open}
      style={styles.card}
    >
      <Image
        source={POSTER}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
      />
      <View style={[styles.shade, backgroundCss(SHADE)]} />
      <View style={styles.words}>
        <AppText variant="heading" color="onPhoto">
          {t('vendorJoin.entry.cardTitle')}
        </AppText>
        <AppText color="onPhoto" style={styles.soft}>
          {t('vendorJoin.entry.cardBody')}
        </AppText>
        <View style={styles.cardPill}>
          <AppText variant="label" weight={700} style={styles.cardPillText}>
            {t('vendorJoin.entry.cardButton')}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  // Business mode's label's size and shape, in the plain grey of the family side
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    minHeight: 300,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.viewer,
  },
  shade: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },
  words: {
    gap: Spacing.xs + 2,
    padding: Spacing.xl - 4,
  },
  soft: {
    opacity: 0.88,
  },
  // White with black words in both modes: it sits on the photo
  cardPill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    backgroundColor: Colors.onPhoto,
  },
  cardPillText: {
    color: Colors.viewer,
  },
}));
