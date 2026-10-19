import { createRef, useMemo, useState, type RefObject } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Sizes, Spacing } from '@/constants/theme';
import { CARD_DESIGNS, type CardText } from '@/features/cards/card-designs';
import { printCards, saveCard } from '@/features/cards/card-export';
import { InvitationCard } from '@/features/cards/invitation-card';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

import { EVENTS, WEDDING } from './mock';

/** A ref for each card, by position. */
export function useCardRefs(count: number): RefObject<View | null>[] {
  return useMemo(() => Array.from({ length: count }, () => createRef<View>()), [count]);
}

/**
 * The cards for some of the family's events, side by side, one look each
 * (Ivory and gold, Maroon and gold, Sage garden...). Filled in from Wed's
 * plan (mock.ts, until the real brain reads the family's own, #124). With
 * `refs`, each card can be saved as a picture.
 */
export function WedCards({
  events,
  width,
  refs,
}: {
  events: string[];
  width: number;
  refs?: RefObject<View | null>[];
}) {
  const { t } = useLocale();
  const cards = events.flatMap((slug) => EVENTS.find((e) => e.slug === slug) ?? []);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={width + Spacing.md}
      // Runs to the screen's edges, starting in line with the thread
      style={{ marginHorizontal: -Sizes.pageGutter }}
      contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Sizes.pageGutter }}
    >
      {cards.map((event, index) => {
        const text: CardText = {
          opening: t('cards.defaults.opening'),
          names: WEDDING.couple,
          invite: t('cards.defaults.invite'),
          event: event.name,
          date: event.card.date,
          time: event.card.time,
          venue: event.card.place,
          note: '',
        };
        return (
          <InvitationCard
            key={event.slug}
            ref={refs?.[index]}
            design={CARD_DESIGNS[index % CARD_DESIGNS.length]}
            text={text}
            namesSample=""
            width={width}
          />
        );
      })}
    </ScrollView>
  );
}

type Action = 'save' | 'print';

/** In the thread: the cards Wed made, with Save to Photos and Print for all of them. */
export function CardsRow({ events }: { events: string[] }) {
  const { t } = useLocale();
  const { width: screen } = useWindowDimensions();
  const refs = useCardRefs(events.length);
  const [busy, setBusy] = useState<Action | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<Action | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setSaved(false);
    setFailed(null);
    try {
      if (action === 'save') {
        for (const card of refs) if (!(await saveCard(card))) throw new Error('not_saved');
        successHaptic();
        setSaved(true);
      } else {
        await printCards(refs);
      }
    } catch {
      setFailed(action);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: Spacing.md }}>
      <WedCards events={events} width={Math.min(300, screen * 0.78)} refs={refs} />
      <Button
        variant="secondary"
        icon="images-outline"
        label={t('wedCards.save', { count: events.length })}
        disabled={busy !== null}
        loading={busy === 'save'}
        onPress={() => void run('save')}
      />
      <Button
        variant="secondary"
        icon="print-outline"
        label={t('cards.print')}
        disabled={busy !== null}
        loading={busy === 'print'}
        onPress={() => void run('print')}
      />
      {saved && (
        <AppText color="success" weight={600} accessibilityLiveRegion="polite">
          {t('wedCards.saved', { count: events.length })}
        </AppText>
      )}
      {failed && <FieldError message={t(`cards.failed.${failed}`)} />}
    </View>
  );
}
