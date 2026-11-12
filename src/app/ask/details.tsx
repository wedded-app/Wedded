import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useTypeStyle } from '@/components/app-text';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import {
  setAsk,
  toggleVisitDay,
  type Alcohol,
  type AskDraft,
  type Meat,
  type TimeOfDay,
  type WhoCooks,
} from '@/features/inquiry/ask-draft';
import {
  ChoicePills,
  ChoiceTiles,
  CounterTiles,
  MenuCards,
  NoteLine,
  Question,
  useArrive,
} from '@/features/inquiry/ask-parts';
import { AskScreen } from '@/features/inquiry/ask-screen';
import { AskStep } from '@/features/inquiry/ask-step';
import type { DayPart } from '@/features/inquiry/details';
import { fromDateString, toDateString, type HallAnswers } from '@/features/inquiry/inquiry-helpers';
import { useAsk } from '@/features/inquiry/use-ask';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/**
 * Ask for a quote, page 4 of 5: what this vendor needs to know. A hall asks
 * day or evening, who's bringing the food, drinks and, when their traditions
 * have one, the baraat or zaffa arriving, each in
 * the hall's own terms (a hall that doesn't cook shows Their kitchen as not
 * offered); choosing Their kitchen opens the menu under it. A caterer asks
 * about the menu; anyone else, day or evening and where. A visit asks which
 * days instead. Everything is optional except where, for vendors who come to it.
 */
export default function AskDetailsStep() {
  const ask = useAsk();
  const { t } = useLocale();
  const { draft, set, v, name } = ask;
  const hall = v?.hall ?? {};
  const needsPlace = set !== 'venue';
  const next = () => router.push('/ask/message');

  if (draft.tour && set === 'venue') {
    return (
      <AskScreen ask={ask}>
        <AskStep
          step={4}
          heading={ask.heading}
          photo={ask.photo}
          title={t('ask.details.visitTitle')}
          subtitle={t('ask.details.visitSubtitle')}
          summary={t('ask.details.visitPicked', { number: draft.visitDays.length })}
          onContinue={next}
        >
          <VisitQuestions draft={draft} />
        </AskStep>
      </AskScreen>
    );
  }

  const hallQuestions = set === 'venue' ? hallAsks(hall) : null;
  const answered =
    set === 'venue'
      ? [
          draft.timeOfDay,
          draft.whoCooks,
          hallQuestions?.alcohol ? draft.alcohol : 'skip',
          ask.procession ? draft.baraat : 'skip',
        ].filter((answer) => answer !== null).length
      : 0;

  return (
    <AskScreen ask={ask}>
      <AskStep
        step={4}
        heading={ask.heading}
        photo={ask.photo}
        title={
          set === 'venue'
            ? t('ask.details.hallTitle')
            : set === 'caterer'
              ? t('ask.details.catererTitle')
              : t('ask.details.otherTitle', { vendor: name })
        }
        subtitle={
          set === 'venue'
            ? t('ask.details.subtitle')
            : set === 'caterer'
              ? t('ask.details.catererSubtitle')
              : t('ask.details.otherSubtitle')
        }
        summary={
          set === 'venue'
            ? t('ask.details.answered', { number: answered, total: 4 })
            : needsPlace && !ask.place.trim()
              ? t('ask.details.whereMissing')
              : undefined
        }
        canContinue={!needsPlace || ask.place.trim().length > 0}
        onContinue={next}
      >
        {set === 'venue' ? (
          <HallQuestions
            draft={draft}
            hall={hall}
            vendor={name}
            procession={
              ask.procession && {
                name: localized(ask.procession.name),
                horse: ask.procession.slug === 'baraat',
              }
            }
          />
        ) : set === 'caterer' ? (
          <>
            <WhereQuestion place={ask.place} />
            <MenuQuestions draft={draft} />
            <Question title={t('ask.details.tasting')}>
              <ChoicePills
                label={t('ask.details.tasting')}
                options={[
                  { value: 'yes', label: t('ask.details.tastingYes') },
                  { value: 'no', label: t('ask.details.no') },
                ]}
                value={draft.tasting === null ? null : draft.tasting ? 'yes' : 'no'}
                onChange={(value) => setAsk({ tasting: value === 'yes' })}
              />
            </Question>
            <TimeOfDayQuestion draft={draft} />
          </>
        ) : (
          <>
            <WhereQuestion place={ask.place} />
            <TimeOfDayQuestion draft={draft} />
          </>
        )}
      </AskStep>
    </AskScreen>
  );
}

/** Which of a hall's questions to ask, in its own terms, from what it told us. */
function hallAsks(hall: HallAnswers) {
  const kitchenOff = hall.inHouseCatering === 'no';
  const ownOff = hall.outsideCatering === 'no';
  return {
    kitchenOff,
    ownOff,
    fromList: hall.outsideCatering === 'approved_list',
    // A dry hall: nothing to ask
    alcohol: hall.alcoholPolicy !== 'dry',
  };
}

function TimeOfDayQuestion({ draft }: { draft: AskDraft }) {
  const { t } = useLocale();
  return (
    <Question title={t('ask.details.timeOfDay')}>
      <ChoiceTiles<TimeOfDay>
        label={t('ask.details.timeOfDay')}
        tiles={[
          {
            value: 'day',
            label: t('ask.details.times.day'),
            sub: t('ask.details.timesSub.day'),
            icon: 'sunny-outline',
          },
          {
            value: 'evening',
            label: t('ask.details.times.evening'),
            sub: t('ask.details.timesSub.evening'),
            icon: 'moon-outline',
          },
          {
            value: 'both',
            label: t('ask.details.times.both'),
            sub: t('ask.details.timesSub.both'),
            icon: 'contrast-outline',
          },
        ]}
        value={draft.timeOfDay}
        onChange={(timeOfDay) => setAsk({ timeOfDay })}
      />
    </Question>
  );
}

function HallQuestions({
  draft,
  hall,
  vendor,
  procession,
}: {
  draft: AskDraft;
  hall: HallAnswers;
  vendor: string;
  /** Their tradition's arriving procession; a baraat comes with a horse. */
  procession: { name: string; horse: boolean } | null;
}) {
  const { t } = useLocale();
  const asks = hallAsks(hall);
  // What tapping a choice the hall doesn't offer says
  const [offTapped, setOffTapped] = useState<WhoCooks | null>(null);
  const foodNote = asks.kitchenOff
    ? t('ask.details.foodHallOnly', { vendor })
    : asks.ownOff
      ? t('ask.details.foodKitchenOnly', { vendor })
      : asks.fromList
        ? t('ask.details.foodApproved', { vendor })
        : hall.inHouseCatering && hall.outsideCatering
          ? t('ask.details.foodBoth', { vendor })
          : null;

  return (
    <>
      <TimeOfDayQuestion draft={draft} />

      <Question title={t('ask.details.food')} note={foodNote}>
        <ChoiceTiles<WhoCooks>
          label={t('ask.details.food')}
          tiles={[
            {
              value: 'kitchen',
              label: t('ask.details.cooks.kitchen'),
              sub: t(
                asks.kitchenOff
                  ? 'ask.details.cooksSub.kitchenOff'
                  : 'ask.details.cooksSub.kitchen',
              ),
              icon: 'restaurant-outline',
              off: asks.kitchenOff,
            },
            {
              value: 'own',
              label: t('ask.details.cooks.own'),
              sub: t(
                asks.ownOff
                  ? 'ask.details.cooksSub.ownOff'
                  : asks.fromList
                    ? 'ask.details.cooksSub.ownList'
                    : 'ask.details.cooksSub.own',
              ),
              icon: 'bag-handle-outline',
              off: asks.ownOff,
            },
            {
              value: 'not_sure',
              label: t('ask.details.cooks.not_sure'),
              sub: t('ask.details.cooksSub.not_sure'),
              icon: 'help-circle-outline',
            },
          ]}
          value={draft.whoCooks}
          onChange={(whoCooks) => {
            setOffTapped(null);
            setAsk({ whoCooks });
          }}
          onOff={setOffTapped}
        />
        {offTapped && (
          <NoteLine
            warn
            text={t(offTapped === 'kitchen' ? 'ask.details.kitchenOff' : 'ask.details.ownOff', {
              vendor,
            })}
          />
        )}
        {!offTapped && draft.whoCooks === 'own' && (
          <NoteLine text={t(asks.fromList ? 'ask.details.ownListNote' : 'ask.details.ownNote')} />
        )}
        {!offTapped && draft.whoCooks === 'not_sure' && (
          <NoteLine text={t('ask.details.unsureNote')} />
        )}
      </Question>

      {draft.whoCooks === 'kitchen' && <MenuQuestions draft={draft} framed />}

      {asks.alcohol && <DrinksQuestion draft={draft} hall={hall} />}

      {procession && (
        <Question
          title={t('ask.details.baraat', { event: procession.name })}
          note={procession.horse ? baraatNote(hall, t) : t('ask.details.processionNote')}
        >
          <ChoicePills
            label={t('ask.details.baraat', { event: procession.name })}
            options={[
              { value: 'yes', label: t('ask.details.yes') },
              { value: 'no', label: t('ask.details.no') },
            ]}
            value={draft.baraat === null ? null : draft.baraat ? 'yes' : 'no'}
            onChange={(value) => setAsk({ baraat: value === 'yes' })}
          />
        </Question>
      )}
    </>
  );
}

function baraatNote(hall: HallAnswers, t: Translate): string {
  if (hall.ghoriAllowed === false) return t('ask.details.baraatNoHorse');
  if (hall.ghoriAllowed) {
    return t(hall.dholOutsideAllowed ? 'ask.details.baraatAllowed' : 'ask.details.baraatHorse');
  }
  return t('ask.details.baraatNote');
}

/** Their bar, bringing their own, or whether there'll be alcohol at all. */
function DrinksQuestion({ draft, hall }: { draft: AskDraft; hall: HallAnswers }) {
  const { t } = useLocale();
  const policy = hall.alcoholPolicy;
  const hasBar = policy === 'full_bar' || policy === 'beer_wine';
  const byob = policy === 'byob';
  const title = hasBar
    ? t('ask.details.bar')
    : byob
      ? t('ask.details.byob')
      : t('ask.details.alcohol');
  const note =
    policy === 'full_bar'
      ? t('ask.details.barFull')
      : policy === 'beer_wine'
        ? t('ask.details.barBeerWine')
        : byob
          ? hall.corkage
            ? t('ask.details.byobFee', { fee: `$${hall.corkage.toLocaleString('en-US')}` })
            : t('ask.details.byobNote')
          : null;
  return (
    <Question title={title} note={note}>
      <ChoicePills<Alcohol>
        label={title}
        options={[
          {
            value: 'yes',
            label: byob ? t('ask.details.alcohols.bring') : t('ask.details.alcohols.yes'),
          },
          { value: 'no', label: t('ask.details.alcohols.no') },
          { value: 'not_sure', label: t('ask.details.alcohols.not_sure') },
        ]}
        value={draft.alcohol}
        onChange={(alcohol) => setAsk({ alcohol })}
      />
    </Question>
  );
}

/** The menu: photo cards to swipe, jhatka or halal for non-veg, and live counters. */
function MenuQuestions({ draft, framed = false }: { draft: AskDraft; framed?: boolean }) {
  const styles = useStyles();
  const { t } = useLocale();
  const arrive = useArrive();
  return (
    <Animated.View
      entering={framed ? arrive : undefined}
      style={[styles.menu, framed && styles.framed]}
    >
      <Question title={t('ask.details.menu')} note={t('ask.details.menuHint')}>
        <MenuCards value={draft.menu} onChange={(menu) => setAsk({ menu })} />
      </Question>
      {draft.menu === 'nonveg' && (
        <Question title={t('ask.details.meat')}>
          <ChoicePills<Meat>
            label={t('ask.details.meat')}
            options={[
              { value: 'jhatka', label: t('ask.details.meats.jhatka') },
              { value: 'halal', label: t('ask.details.meats.halal') },
              { value: 'either', label: t('ask.details.meats.either') },
            ]}
            value={draft.meat}
            onChange={(meat) => setAsk({ meat })}
          />
        </Question>
      )}
      <Question title={t('ask.details.counters')}>
        <CounterTiles
          value={draft.liveCounters}
          onChange={(liveCounters) => setAsk({ liveCounters })}
        />
      </Question>
    </Animated.View>
  );
}

/** Where the event is, for vendors who come to it: a big underlined line, filled in from their town. */
function WhereQuestion({ place }: { place: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { maxFontSizeMultiplier, ...type } = useTypeStyle({ variant: 'bodyLg' });
  const [focused, setFocused] = useState(false);
  return (
    <Question title={t('ask.details.where')}>
      <TextInput
        value={place}
        onChangeText={(text) => setAsk({ place: text })}
        placeholder={t('ask.details.whereHint')}
        placeholderTextColor={Colors.textDisabled}
        accessibilityLabel={t('ask.details.where')}
        autoCapitalize="words"
        autoComplete="off"
        textContentType="location"
        maxLength={120}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        returnKeyType="done"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[type, styles.line, { color: Colors.text }, focused && styles.lineOn]}
      />
    </Question>
  );
}

/** The next three weeks as day tiles, up to three picked, and the part of the day. */
function VisitQuestions({ draft }: { draft: AskDraft }) {
  const styles = useStyles();
  const { t } = useLocale();
  const days = Array.from({ length: 21 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return toDateString(date);
  });
  return (
    <>
      <Question title={t('ask.details.visitDays')}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}
          style={styles.bleed}
        >
          {days.map((day) => {
            const on = draft.visitDays.includes(day);
            const full = !on && draft.visitDays.length >= 3;
            const date = fromDateString(day);
            const spoken = date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            });
            return (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: full }}
                accessibilityLabel={spoken}
                onPress={() => {
                  if (full) return;
                  selectionHaptic();
                  setAsk({ visitDays: toggleVisitDay(draft.visitDays, day) });
                }}
                style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && styles.pressed]}
              >
                <AppText
                  variant="caption"
                  weight={600}
                  color={on ? 'onPrimary' : full ? 'textDisabled' : 'text2'}
                  style={styles.caps}
                >
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </AppText>
                <AppText
                  weight={700}
                  color={on ? 'onPrimary' : full ? 'textDisabled' : 'text'}
                  style={styles.dayNumber}
                >
                  {String(date.getDate())}
                </AppText>
                <AppText
                  variant="caption"
                  weight={600}
                  color={on ? 'onPrimary' : full ? 'textDisabled' : 'text2'}
                  style={styles.caps}
                >
                  {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </Question>
      <Question title={t('ask.details.visitPart')}>
        <ChoicePills<DayPart>
          label={t('ask.details.visitPart')}
          options={(['morning', 'afternoon', 'evening'] as DayPart[]).map((part) => ({
            value: part,
            label: t(`inquiry.questions.parts.${part}`),
          }))}
          value={draft.visitPart}
          onChange={(visitPart) => setAsk({ visitPart })}
        />
      </Question>
    </>
  );
}

const useStyles = makeStyles((Colors) => ({
  menu: {
    gap: Spacing.xxl,
  },
  framed: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  line: {
    minHeight: Sizes.input,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.separator,
  },
  lineOn: {
    borderBottomColor: Colors.text,
  },
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  days: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
    paddingVertical: 2,
  },
  day: {
    width: 66,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayOn: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  pressed: {
    opacity: 0.7,
  },
  caps: {
    letterSpacing: 0.6,
  },
  dayNumber: {
    fontSize: 24,
    lineHeight: 28,
  },
}));
