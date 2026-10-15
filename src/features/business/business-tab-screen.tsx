import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { ChatButton } from '@/features/chat/chat-button';
import { useLocale } from '@/i18n/locale-context';

/**
 * The frame of every business-mode tab: the saffron Business label at the top
 * left, where Back would be, so it's always clear which side of the app this
 * is, and the chat button at the top right, as on Home.
 */
export function BusinessTabScreen(props: ComponentProps<typeof NavScreen>) {
  return (
    <NavScreen back={false} leading={<BusinessLabel />} trailing={<ChatButton />} {...props} />
  );
}

function BusinessLabel() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View
      style={styles.label}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('businessMode.labelA11y')}
    >
      <Icon name="storefront" size={18} color={Colors.kesari} />
      <AppText variant="label" weight={700} color="kesari" maxFontSizeMultiplier={1.3}>
        {t('businessMode.label')}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.kesariTint,
  },
}));
