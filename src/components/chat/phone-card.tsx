import { Linking, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { formatPhone } from '@/lib/phone';

/**
 * A family's number, shared when they tapped "Share my number" (C2: it never
 * reaches a vendor otherwise). The vendor gets Call and Text; the family
 * sees that they shared it.
 */
export function PhoneCard({ phone, mine }: { phone: string; mine: boolean }) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const number = formatPhone(phone);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Icon name="call-outline" size={20} color={Colors.primary} />
        <AppText variant="label" weight={600} color="primary">
          {mine ? t('chat.phone.youShared') : t('chat.phone.shared')}
        </AppText>
      </View>
      <AppText variant="heading" weight={700} selectable>
        {number}
      </AppText>
      {!mine && (
        <View style={styles.actions}>
          <View style={styles.grow}>
            <Button
              icon="call-outline"
              label={t('chat.phone.call')}
              accessibilityLabel={t('chat.phone.callSpoken', { number })}
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            />
          </View>
          <View style={styles.grow}>
            <Button
              variant="secondary"
              icon="chatbubble-outline"
              label={t('chat.phone.text')}
              accessibilityLabel={t('chat.phone.textSpoken', { number })}
              onPress={() => void Linking.openURL(`sms:${phone}`)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  grow: {
    flexGrow: 1,
    minWidth: 140,
  },
}));
