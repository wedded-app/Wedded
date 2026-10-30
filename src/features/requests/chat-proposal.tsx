import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { Conversation, Message } from '@/data/chat';
import { useMyProposals, useRequestProposals } from '@/data/requests';
import { useLocale } from '@/i18n/locale-context';

import { dollars } from './requests-format';

/**
 * A 'proposal' message (#219): the vendor's proposal from Families looking as
 * a card (the price, its unit, their note), or, when the family chose it, a
 * small "Chosen" line under it. The price comes from the proposal itself:
 * the family's list for the request, or the vendor's own sent proposals.
 */
export function ChatProposal({
  message,
  conversation,
}: {
  message: Message;
  conversation: Conversation | null;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const vendorSide = conversation?.side === 'vendor';
  const ref = message.proposal;
  const family = useRequestProposals(!vendorSide && ref ? ref.requestId : '');
  const sent = useMyProposals(vendorSide && conversation ? conversation.vendor.id : '');
  if (!ref) return null;

  if (ref.update === 'accepted') {
    return (
      <View style={styles.line} accessibilityRole="text">
        <Icon name="checkmark-circle" size={18} color={Colors.success} />
        <AppText variant="label" weight={600} color="success">
          {t(vendorSide ? 'requests.chat.chosenVendor' : 'requests.chat.chosenFamily')}
        </AppText>
      </View>
    );
  }

  const proposal = vendorSide
    ? sent.data?.find((p) => p.id === ref.proposalId)
    : family.data?.find((p) => p.id === ref.proposalId);

  return (
    <View style={styles.card}>
      <View style={styles.title}>
        <Icon name="paper-plane-outline" size={18} color={Colors.text2} />
        <AppText variant="label" weight={600} color="text2">
          {t('requests.chat.title')}
        </AppText>
      </View>
      {proposal?.priceCents != null && (
        <View style={styles.price}>
          <AppText variant="title" style={styles.tabular}>
            {dollars(proposal.priceCents)}
          </AppText>
          {proposal.priceUnit && (
            <AppText color="text2">{t(`requests.units.${proposal.priceUnit}`)}</AppText>
          )}
        </View>
      )}
      {message.body ? <AppText>{message.body}</AppText> : null}
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
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
}));
