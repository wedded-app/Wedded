import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, useFontScale, type AppTextProps } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { type ColorToken, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';

// Where a row's text starts when it has an icon: the separator lines up with it.
const TEXT_INSET = Spacing.lg + Sizes.rowIcon + Spacing.md;

/**
 * A bold 22-point heading over a block of the page, like "Browse by vendor
 * type" (App Store's section titles). Group headers inside a section are
 * ListSection's `header`.
 */
export function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <AppText variant="section" accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </AppText>
  );
}

export type ListSectionProps = {
  /** A short heading above the rounded group, in sentence case. */
  header?: string;
  /** One or two lines of explanation under the group. */
  footer?: string;
  /** Rows have an icon, so the hairlines start where the text does. */
  inset?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * An iOS inset-grouped section: rows on one white rounded surface with
 * hairlines between them, like Settings. Put ListRows (or any view) inside.
 */
export function ListSection({ header, footer, inset = false, children, style }: ListSectionProps) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.section, style]}>
      {header && (
        <AppText
          variant="label"
          weight={600}
          color="text2"
          accessibilityRole="header"
          style={styles.header}
        >
          {header}
        </AppText>
      )}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 && <View style={[styles.separator, inset && styles.separatorInset]} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && (
        <AppText variant="caption" color="text2" style={styles.footer}>
          {footer}
        </AppText>
      )}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  /** A second line of details. */
  subtitle?: string;
  /** A glyph in the app colour at the start of the row. */
  icon?: IconName;
  iconColor?: ColorToken;
  /** A value on the right in grey, like "25 mi" or "English". */
  value?: string;
  /** Title colour; `primary` for actions, `error` for destructive ones. */
  tone?: 'default' | 'primary' | 'error';
  /** Shows a chevron: the row opens something. Off for actions. */
  chevron?: boolean;
  /** A checkmark on the right, for picking one of several rows. */
  checked?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'radio';
  /** Anything else on the right instead of the value and chevron. */
  trailing?: ReactNode;
  /** Anything on the left instead of the icon, e.g. a number badge. */
  leading?: ReactNode;
  titleVariant?: AppTextProps['variant'];
};

/**
 * One row of a ListSection: optional icon, title (and a second line), then a
 * grey value and a chevron. Grey highlight while held, as on iOS. At least
 * 60 tall, and it grows when text wraps; nothing truncates.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  iconColor = 'primary',
  value,
  tone = 'default',
  chevron,
  checked,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  trailing,
  leading,
  titleVariant = 'body',
}: ListRowProps) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  const showChevron = chevron ?? (!!onPress && tone === 'default' && checked === undefined);
  const titleColor: ColorToken =
    tone === 'primary' ? 'primary' : tone === 'error' ? 'error' : 'text';

  const content = (
    <>
      {leading}
      {!leading && icon && (
        <View style={[styles.iconSlot, { width: Sizes.rowIcon * Math.min(scale, 1.4) }]}>
          <Icon
            name={icon}
            size={Sizes.icon * Math.min(scale, 1.4)}
            color={Colors[tone === 'error' ? 'error' : iconColor]}
          />
        </View>
      )}
      <View style={styles.text}>
        <AppText variant={titleVariant} color={titleColor}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="label" weight={400} color="text2">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {!trailing && value ? (
        <AppText color="text2" style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {checked !== undefined && (
        <View style={styles.check}>
          {checked && (
            <Icon
              name="checkmark"
              size={Sizes.iconSmall * scale}
              color={Colors.primary}
              weight="semibold"
            />
          )}
        </View>
      )}
      {showChevron && (
        <Icon
          name="chevron-forward"
          size={17 * Math.min(scale, 1.4)}
          color={Colors.chevron}
          weight="semibold"
        />
      )}
    </>
  );

  if (!onPress) {
    return (
      // One element for screen readers, unless it holds a control (a switch,
      // a button) that has to stay reachable on its own
      <View style={styles.row} accessible={!trailing} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityState={checked !== undefined ? { selected: checked } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  sectionTitle: {
    paddingHorizontal: Spacing.xs,
    marginBottom: -Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  header: {
    paddingHorizontal: Spacing.lg,
  },
  group: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    // White rows on the white page: the warm hairline is the edge
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg,
    backgroundColor: Colors.separator,
  },
  separatorInset: {
    marginLeft: TEXT_INSET,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  iconSlot: {
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  check: {
    width: Sizes.iconSmall,
    alignItems: 'center',
  },
}));
