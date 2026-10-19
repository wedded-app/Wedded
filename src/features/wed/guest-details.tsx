import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconLine } from '@/components/icon-line';
import { ListRow, ListSection } from '@/components/list';
import { Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import type { GuestListState } from './guest-list';
import { GUEST_CHANNELS, namesPreview, reachable, type GuestSend } from './send-to-guests';
import { WedCards } from './wed-cards';
import { wed } from './wed-store';

/**
 * On a card that sends to guests, everything the family checks before Send:
 * the list, how many people and their first names; how it goes (each person
 * their own text, the default, one group text, or email); and the cards.
 * The message is the card's usual Message box.
 */
export function GuestDetails({
  id,
  send,
  list,
  editable,
}: {
  id: string;
  send: GuestSend;
  list: GuestListState;
  /** Only the one who says yes picks how it goes. */
  editable: boolean;
}) {
  const { t } = useLocale();
  return (
    <>
      <Who send={send} list={list} />
      <ListSection header={t('wedSend.how')}>
        {GUEST_CHANNELS.map((channel) => (
          <ListRow
            key={channel}
            title={t(`wedSend.channels.${channel}.title`)}
            subtitle={t(`wedSend.channels.${channel}.body`)}
            accessibilityRole="radio"
            checked={send.channel === channel}
            onPress={
              editable
                ? () => {
                    if (channel !== send.channel) selectionHaptic();
                    wed.setChannel(id, channel);
                  }
                : undefined
            }
          />
        ))}
      </ListSection>
      <WedCards events={send.events} width={96} />
    </>
  );
}

/** "Mehndi list · 40 people", then "Priya, Aman, Raj and 37 more", or why there's no one yet. */
function Who({ send, list }: { send: GuestSend; list: GuestListState }) {
  const { t } = useLocale();
  const asked = { list: send.list };
  if (list.status !== 'ready') {
    return (
      <IconLine icon="people-outline" color="text2">
        {t(`wedSend.list.${list.status}`, asked)}
      </IconLine>
    );
  }
  const { names, more } = namesPreview(list.recipients);
  const reached = reachable(send.channel, list.recipients).length;
  const missing = list.recipients.length - reached;
  return (
    <View style={{ gap: Spacing.xs }}>
      <AppText weight={600}>
        {t('wedSend.list.ready', { list: list.name, count: list.recipients.length })}
      </AppText>
      {names.length > 0 && (
        <AppText color="text2">
          {more > 0
            ? t('wedSend.names.more', { names: names.join(', '), count: more })
            : names.join(', ')}
        </AppText>
      )}
      {missing > 0 && (
        <AppText color="text2">
          {t(send.channel === 'email' ? 'wedSend.noEmail' : 'wedSend.noPhone', { count: missing })}
        </AppText>
      )}
    </View>
  );
}
