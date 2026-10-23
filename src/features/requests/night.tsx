import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ambient-glow';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { useBottomSpace } from '@/components/tab-bar';
import {
  backgroundCss,
  makeStyles,
  Radius,
  Sizes,
  Spacing,
  SchemeContext,
  useColors,
} from '@/constants/theme';
import { formatDate } from '@/features/inquiry/inquiry-helpers';

import { initials } from './requests-format';

/**
 * The "wedding night" page for Requests and Wedded Pro: plum black with soft
 * rose, gold and plum light drifting behind (still with Reduce Motion), like
 * the promo video. Always drawn in dark. A big serif title, an eyebrow above
 * it, the content, and an optional `footer` pinned at the bottom (the main
 * button), so the action is always in reach.
 */
export function NightScreen({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  top,
  refreshControl,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** In place of the Back button: a close button for sheets, or a progress line; false for none (a tab). */
  top?: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  return (
    <SchemeContext.Provider value="dark">
      <NightBody
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        footer={footer}
        top={top}
        refreshControl={refreshControl}
      >
        {children}
      </NightBody>
    </SchemeContext.Provider>
  );
}

function NightBody({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  top,
  refreshControl,
}: Parameters<typeof NightScreen>[0]) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Clears the floating tab bar inside the tabs, or the home indicator elsewhere
  const bottom = useBottomSpace();
  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <AmbientGlow />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.sm,
            paddingBottom: footer ? 180 : bottom + Spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={styles.top}>{top ?? <BackButton />}</View>
        {(eyebrow || title) && (
          <View style={styles.heading}>
            {eyebrow ? (
              <AppText variant="label" weight={700} color="champagne">
                {eyebrow}
              </AppText>
            ) : null}
            {title ? (
              <AppText variant="display" weight={600} accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {subtitle ? (
              <AppText variant="bodyLg" color="text2">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        )}
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** A frosted card on the night page: a faint white fill and a hairline edge. */
export function GlassCard({
  children,
  style,
  strong = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}) {
  const styles = useStyles();
  return <View style={[styles.glass, strong && styles.glassStrong, style]}>{children}</View>;
}

/**
 * The night page's main button: a rose-to-maroon pill that glows, 60 tall.
 * `glass` is the quiet one beside it.
 */
export function GlowButton({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
  glass = false,
  accessibilityHint,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  glass?: boolean;
  accessibilityHint?: string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const off = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={off ? undefined : onPress}
      pressedScale={0.97}
      style={[
        styles.button,
        glass ? styles.buttonGlass : [backgroundCss(Colors.nightButton), styles.buttonGlow],
        off && styles.off,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.onHero} />
      ) : icon ? (
        <Icon name={icon} size={20} color={Colors.onHero} weight="semibold" />
      ) : null}
      <AppText variant="button" weight={700} color="onHero" style={styles.buttonLabel}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** A date as a little calendar page: the month in gold, the day huge, the weekday. */
export function DateTile({ date, size = 'md' }: { date: string; size?: 'md' | 'lg' }) {
  const styles = useStyles();
  const d = new Date(`${date}T12:00:00`);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d).toUpperCase();
  const day = String(d.getDate());
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
  const big = size === 'lg';
  return (
    <View
      style={[styles.dateTile, big && styles.dateTileLg]}
      accessible
      accessibilityLabel={formatDate(date)}
    >
      <AppText variant="caption" weight={700} color="champagne" maxFontSizeMultiplier={1.3}>
        {month}
      </AppText>
      <AppText weight={600} style={big ? styles.dayLg : styles.day} maxFontSizeMultiplier={1.2}>
        {day}
      </AppText>
      <AppText variant="caption" color="text2" maxFontSizeMultiplier={1.3}>
        {weekday}
      </AppText>
    </View>
  );
}

/** Up to four vendors' faces overlapping, then "+2". */
export function FaceStack({
  people,
  size = 32,
}: {
  people: { name: string; photoUrl: string | null }[];
  size?: number;
}) {
  const styles = useStyles();
  const shown = people.slice(0, 4);
  const more = people.length - shown.length;
  return (
    <View style={styles.faces} accessible={false}>
      {shown.map((p, i) => (
        <View
          key={`${p.name}-${i}`}
          style={[
            styles.face,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : -size / 3,
            },
          ]}
        >
          {p.photoUrl ? (
            <Image
              source={{ uri: p.photoUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <AppText
              weight={700}
              color="onHero"
              style={{ fontSize: size * 0.4 }}
              maxFontSizeMultiplier={1}
            >
              {initials(p.name).slice(0, 1)}
            </AppText>
          )}
        </View>
      ))}
      {more > 0 && (
        <AppText variant="label" weight={600} color="text2" style={{ marginLeft: Spacing.xs }}>
          {`+${more}`}
        </AppText>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  page: {
    flex: 1,
    backgroundColor: Colors.night,
  },
  content: {
    gap: Spacing.lg,
    paddingHorizontal: Sizes.pageGutter,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  heading: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.xxl,
    paddingHorizontal: Sizes.pageGutter,
    // Solid behind the button and its note, then a short fade to the page.
    ...backgroundCss(
      'linear-gradient(to top, rgba(18,6,10,1) 0%, rgba(18,6,10,1) 62%, rgba(18,6,10,0) 100%)',
    ),
  },
  glass: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCard,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  glassStrong: {
    backgroundColor: Colors.nightCardStrong,
  },
  button: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 30,
    backgroundColor: Colors.primaryFill,
  },
  buttonGlow: {
    boxShadow: Colors.roseGlow,
  },
  buttonGlass: {
    // Solid, so text scrolling under the pinned footer never shows through.
    backgroundColor: Colors.nightRaised,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  buttonLabel: {
    fontSize: 18,
    textAlign: 'center',
    flexShrink: 1,
  },
  off: {
    opacity: 0.5,
  },
  dateTile: {
    width: 68,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
  dateTileLg: {
    width: 92,
    paddingVertical: Spacing.md,
  },
  day: {
    fontSize: 30,
    lineHeight: 36,
  },
  dayLg: {
    fontSize: 44,
    lineHeight: 50,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.night,
    backgroundColor: Colors.primaryFill,
  },
}));
