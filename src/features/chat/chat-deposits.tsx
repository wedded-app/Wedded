import { createContext, useContext, useState, type ReactNode } from 'react';

import { DepositCard, DepositLine } from '@/components/chat/deposit-card';
import type { Message } from '@/data/chat';
import {
  canCancel,
  canPay,
  type Deposit,
  depositProblem,
  formatCents,
  useCancelDeposit,
  useDeposits,
  useStartDepositPayment,
} from '@/data/deposits';
import { useEventNames } from '@/features/business/business-parts';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';
import { confirm } from '@/lib/confirm';

import { presentDepositPayment } from './deposit-pay';

type ChatDeposits = {
  side: 'family' | 'vendor';
  deposits: Map<string, Deposit>;
  /** The deposit this phone is paying right now. */
  payingId: string | null;
  /** Stripe isn't set up yet: cards say deposits are coming soon. */
  comingSoon: boolean;
  pay: (deposit: Deposit) => void;
  cancel: (deposit: Deposit) => void;
};

const DepositsContext = createContext<ChatDeposits | null>(null);

/**
 * Deposits for one chat (#209): every deposit, kept live, and what paying
 * and cancelling do. Wrap the thread in `DepositsProvider` with its value;
 * `notice` is a sentence for the screen's error line when something fails.
 */
export function useChatDeposits(
  conversationId: string,
  side: 'family' | 'vendor',
  vendorName: string,
) {
  const { t } = useLocale();
  const deposits = useDeposits(conversationId);
  const start = useStartDepositPayment(conversationId);
  const cancelDeposit = useCancelDeposit(conversationId);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const problem = (error: unknown) => {
    const kind = depositProblem(error);
    if (kind === 'notSetUp') setComingSoon(true);
    setNotice(t(`chat.deposit.problems.${kind}`));
  };

  const payNow = async (deposit: Deposit) => {
    setNotice(null);
    setPayingId(deposit.id);
    try {
      const payment = await start.mutateAsync(deposit.id);
      if (payment.kind === 'alreadyPaid') return;
      const outcome = await presentDepositPayment(payment);
      if (outcome === 'paid') successHaptic();
      else if (outcome === 'failed') setNotice(t('chat.deposit.problems.cardFailed'));
      else if (outcome === 'unsupported') setNotice(t('chat.deposit.problems.useApp'));
    } catch (error) {
      problem(error);
    } finally {
      setPayingId(null);
    }
  };

  const value: ChatDeposits = {
    side,
    deposits: deposits.data ?? new Map(),
    payingId,
    comingSoon,
    pay: (deposit) => {
      const amount = formatCents(deposit.amountCents);
      confirm(
        t('chat.deposit.confirmTitle'),
        t('chat.deposit.confirm', { amount, vendor: vendorName }),
        t('chat.deposit.confirmYes', { amount }),
        t('chat.deposit.notNow'),
        () => void payNow(deposit),
        'default',
      );
    },
    cancel: (deposit) =>
      confirm(
        t('chat.deposit.cancelTitle'),
        t('chat.deposit.cancelConfirm', { amount: formatCents(deposit.amountCents) }),
        t('chat.deposit.cancel'),
        t('chat.deposit.keep'),
        () => {
          setNotice(null);
          cancelDeposit.mutate(deposit.id, { onError: problem });
        },
        'default',
      ),
  };
  return { value, notice };
}

export function DepositsProvider({
  value,
  children,
}: {
  value: ChatDeposits;
  children: ReactNode;
}) {
  return <DepositsContext.Provider value={value}>{children}</DepositsContext.Provider>;
}

/**
 * A 'deposit' message: the vendor's request card, or a small line when it's
 * paid or refunded. Nothing until the deposit itself has loaded.
 */
export function ChatDeposit({ message }: { message: Message }) {
  const { t } = useLocale();
  const eventName = useEventNames();
  const chat = useContext(DepositsContext);
  const deposit = message.deposit && chat?.deposits.get(message.deposit.depositId);
  if (!chat || !message.deposit || !deposit) return null;
  const amount = formatCents(deposit.amountCents);

  if (message.deposit.update) {
    const paid = message.deposit.update === 'paid';
    return (
      <DepositLine
        paid={paid}
        text={t(paid ? 'chat.deposit.paidLine' : 'chat.deposit.refundedLine', { amount })}
      />
    );
  }

  const family = chat.side === 'family';
  return (
    <DepositCard
      amount={amount}
      eventName={deposit.eventSlug ? eventName(deposit.eventSlug) : null}
      note={deposit.note}
      status={deposit.status}
      side={chat.side}
      comingSoon={chat.comingSoon && deposit.status !== 'paid'}
      paying={chat.payingId === deposit.id}
      onPay={family && canPay(deposit) ? () => chat.pay(deposit) : undefined}
      onCancel={!family && canCancel(deposit) ? () => chat.cancel(deposit) : undefined}
    />
  );
}
