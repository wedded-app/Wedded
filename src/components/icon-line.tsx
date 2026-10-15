import { StyleSheet, View } from 'react-native';

import { AppText, useFontScale, useTypeStyle, type AppTextProps } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Sizes, Spacing, useColors } from '@/constants/theme';

/**
 * An icon and a line of text, like "Based in Yuba City" with a pin. The icon
 * stays level with the first line when the text wraps at large sizes.
 */
export function IconLine({
  icon,
  children,
  color = 'text',
}: {
  icon: IconName;
  children: string;
  color?: AppTextProps['color'];
}) {
  const Colors = useColors();
  const scale = useFontScale('body');
  const { lineHeight } = useTypeStyle({});

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { height: lineHeight * scale, width: Sizes.icon * scale }]}>
        <Icon name={icon} size={Sizes.iconSmall * scale} color={Colors.text2} />
      </View>
      <AppText color={color} style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});
