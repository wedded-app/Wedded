import { createRef, useMemo, useState, type RefObject } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Sizes, Spacing } from '@/constants/theme';
import { CARD_DESIGNS, cardTime, type CardText } from '@/features/cards/card-designs';
import { printCards, saveCard } from '@/features/cards/card-export';
import { InvitationCard } from '@/features/cards/invitation-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

import { EVENTS, WEDDING } from './mock';

export type WedCard = { slug: string; text: CardText };

/** A ref for each card, by position. */
export function useCardRefs(count: number): RefObject<View | null>[] {
  return useMemo(() => Array.from({ length: count }, () => createRef<View>()), [count]);
}

/**
 * What each event's card says. From the family's own plan when they have
 * one: the wedding's title as the names, then the event's name, day, start
 * time and place (an event not in their plan gets no card). Without a
 * plan, from Wed's sample family (mock.ts), like the rest of the preview.
 * Null while their plan loads.
 */
export function useWedCards(events: string[]): WedCard[] | null {
  const { t } = useLocale();
  const { wedding, loading, events: known } = usePlanView();
  if (loading) return null;
  const lines = {
    opening: t('cards.defaults.opening'),
    invite: t('cards.defaults.invite'),
    note: '',
  };
  return events.flatMap((slug): WedCard[] => {
    const sample = EVENTS.find((e) => e.slug === slug);
    if (wedding) {
      if (!wedding.events.includes(slug)) return [];
      const name = known.find((e) => e.slug === slug)?.name;
      const time = wedding.eventTimes[slug];
      return [
        {
          slug,
          text: {
            ...lines,
            names: wedding.title ?? '',
            event: name ? localized(name) : (sample?.name ?? ''),
            date: wedding.eventDates[slug] ?? null,
            time: time ? cardTime(time) : '',
            venue: wedding.eventPlaces[slug] ?? '',
          },
        },
      ];
    }
    if (!sample) return [];
    return [
      {
        slug,
        text: {
          ...lines,
          names: WEDDING.couple,
          event: sample.name,
          date: sample.card.date,
          time: sample.card.time,
          venue: sample.card.place,
        },
      },
    ];
  });
}

/**
 * Cards side by side, one look each (Ivory and gold, Maroon and gold, Sage
 * garden...). With `refs`, each one can be saved as a picture.
 */
export function WedCards({
  cards,
  width,
  refs,
}: {
  cards: WedCard[];
  width: number;
  refs?: RefObject<View | null>[];
}) {
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
      {cards.map((card, index) => (
        <InvitationCard
          key={card.slug}
          ref={refs?.[index]}
          design={CARD_DESIGNS[index % CARD_DESIGNS.length]}
          text={card.text}
          namesSample=""
          width={width}
        />
      ))}
    </ScrollView>
  );
}

type Action = 'save' | 'print';

/** In the thread: the cards Wed made, with Save to Photos and Print for all of them. */
export function CardsRow({ events }: { events: string[] }) {
  const { t } = useLocale();
  const { width: screen } = useWindowDimensions();
  const cards = useWedCards(events);
  const refs = useCardRefs(cards?.length ?? 0);
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

  if (!cards) return null;
  if (cards.length === 0) return <AppText color="text2">{t('wedCards.none')}</AppText>;
  return (
    <View style={{ gap: Spacing.md }}>
      <WedCards cards={cards} width={Math.min(300, screen * 0.78)} refs={refs} />
      <Button
        variant="secondary"
        icon="images-outline"
        label={t('wedCards.save', { count: cards.length })}
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
          {t('wedCards.saved', { count: cards.length })}
        </AppText>
      )}
      {failed && <FieldError message={t(`cards.failed.${failed}`)} />}
    </View>
  );
}
