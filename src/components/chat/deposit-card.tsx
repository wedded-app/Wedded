import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors, type ColorToken } from '@/constants/theme';
import type { DepositStatus } from '@/data/deposits';
import { useLocale } from '@/i18n/locale-context';

const LOOK: Record<DepositStatus, { icon: IconName; color: ColorToken }> = {
  requested: { icon: 'time-outline', color: 'text2' },
  processing: { icon: 'time-outline', color: 'text2' },
  paid: { icon: 'checkmark-circle', color: 'success' },
  failed: { icon: 'alert-circle-outline', color: 'error' },
  canceled: { icon: 'close-circle-outline', color: 'text2' },
  refunded: { icon: 'arrow-undo-outline', color: 'text2' },
};

/**
 * A vendor's deposit request in the thread: the amount large, the event, the
 * note and where it stands (asked, paying, paid, canceled, refunded). The
 * family gets "Pay $500" while it can be paid; the vendor gets "Cancel
 * request" while nobody is paying it. With `comingSoon` (Stripe isn't set up
 * yet) it says so instead of offering to pay.
 */
export function DepositCard({
  amount,
  eventName,
  note,
  status,
  side,
  onPay,
  paying = false,
  onCancel,
  comingSoon = false,
}: {
  /** "$500", already formatted. */
  amount: string;
  eventName?: string | null;
  note?: string | null;
  status: DepositStatus;
  side: 'family' | 'vendor';
  onPay?: () => void;
  /** The payment has started on this phone: the button waits. */
  paying?: boolean;
  onCancel?: () => void;
  comingSoon?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const look = LOOK[status];
  const statusWords = t(`chat.deposit.status.${status}.${side}`);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name="card-outline" size={18} color={Colors.text2} />
        <AppText variant="label" weight={600} color="text2">
          {t('chat.deposit.title')}
        </AppText>
      </View>
      <AppText variant="title" style={styles.tabular}>
        {amount}
      </AppText>
      {eventName && <AppText weight={600}>{t('chat.quote.for', { event: eventName })}</AppText>}
      {note && <AppText>{note}</AppText>}
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name={look.icon} size={20} color={Colors[look.color]} />
        <AppText weight={600} color={look.color} style={styles.grow}>
          {statusWords}
        </AppText>
      </View>
      {comingSoon ? (
        <AppText variant="label" weight={400} color="text2">
          {t('chat.deposit.comingSoon')}
        </AppText>
      ) : (
        <>
          {onPay && (
            <Button
              label={paying ? t('chat.deposit.paying') : t('chat.deposit.pay', { amount })}
              icon="lock-closed"
              loading={paying}
              onPress={onPay}
            />
          )}
          {onPay && (
            <AppText variant="label" weight={400} color="text2">
              {t('chat.deposit.secure')}
            </AppText>
          )}
          {onCancel && (
            <Button variant="secondary" label={t('chat.deposit.cancel')} onPress={onCancel} />
          )}
        </>
      )}
    </View>
  );
}

/** A deposit's news in the thread, centred and small: "Deposit paid · $500". */
export function DepositLine({ text, paid }: { text: string; paid: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.line} accessibilityRole="text">
      <Icon
        name={paid ? 'checkmark-circle' : 'arrow-undo-outline'}
        size={18}
        color={paid ? Colors.success : Colors.text2}
      />
      <AppText variant="label" weight={600} color={paid ? 'success' : 'text2'}>
        {text}
      </AppText>
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
    boxShadow: `inset 0 0 0 1.5px ${Colors.primaryTint}`,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
}));
