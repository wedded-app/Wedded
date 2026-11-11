import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { Spacing, useScheme } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import {
  LIVE_STATIONS,
  type CatererAnswers,
  type DayPart,
  type TourSlot,
  type VenueAnswers,
} from './details';
import { formatDate, fromDateString, toDateString } from './inquiry-helpers';

const MAX_TOUR_SLOTS = 3;

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** One choice from a few chips; tapping the chosen one again clears it. */
function Choice<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          role="radio"
          label={option.label}
          selected={value === option.value}
          onPress={() => onChange(value === option.value ? null : option.value)}
        />
      ))}
    </View>
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const { t } = useLocale();
  return (
    <Choice
      options={[
        { value: true, label: t('inquiry.questions.yes') },
        { value: false, label: t('inquiry.questions.no') },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

/** Halls and other venues (vision §6 "Inquiry asks" for banquet halls). */
export function VenueQuestions({
  answers,
  onChange,
  isTour,
}: {
  answers: VenueAnswers;
  onChange: (answers: VenueAnswers) => void;
  isTour: boolean;
}) {
  const { t } = useLocale();
  const set = (patch: Partial<VenueAnswers>) => onChange({ ...answers, ...patch });

  return (
    <>
      {isTour && (
        <TourSlots slots={answers.tourSlots} onChange={(tourSlots) => set({ tourSlots })} />
      )}
      <Question title={t('inquiry.questions.catering')}>
        <Choice
          options={[
            { value: 'in_house', label: t('inquiry.questions.cateringInHouse') },
            { value: 'own', label: t('inquiry.questions.cateringOwn') },
            { value: 'not_sure', label: t('inquiry.questions.notSure') },
          ]}
          value={answers.catering}
          onChange={(catering) => set({ catering })}
        />
        {answers.catering === 'own' && (
          <TextField
            label={t('inquiry.questions.whichCaterer')}
            value={answers.ownCaterer}
            onChangeText={(ownCaterer) => set({ ownCaterer })}
            maxLength={80}
          />
        )}
      </Question>
      <Question title={t('inquiry.questions.alcohol')}>
        <Choice
          options={[
            { value: 'yes', label: t('inquiry.questions.yes') },
            { value: 'no', label: t('inquiry.questions.no') },
            { value: 'not_sure', label: t('inquiry.questions.notSure') },
          ]}
          value={answers.alcohol}
          onChange={(alcohol) => set({ alcohol })}
        />
      </Question>
      <Question title={t('inquiry.questions.ghoriDhol')}>
        <YesNo value={answers.ghoriDhol} onChange={(ghoriDhol) => set({ ghoriDhol })} />
      </Question>
      <Question title={t('inquiry.questions.sameDay')}>
        <YesNo value={answers.sameDay} onChange={(sameDay) => set({ sameDay })} />
      </Question>
    </>
  );
}

/** Caterers and halwais (vision §6 "Inquiry asks" for caterers). */
export function CatererQuestions({
  answers,
  onChange,
}: {
  answers: CatererAnswers;
  onChange: (answers: CatererAnswers) => void;
}) {
  const { t } = useLocale();
  const set = (patch: Partial<CatererAnswers>) => onChange({ ...answers, ...patch });

  return (
    <>
      <Question title={t('inquiry.questions.food')}>
        <Choice
          options={[
            { value: 'veg', label: t('inquiry.questions.foodVeg') },
            { value: 'veg_nonveg', label: t('inquiry.questions.foodVegNonVeg') },
            { value: 'jhatka', label: t('inquiry.questions.foodJhatka') },
            { value: 'halal', label: t('inquiry.questions.foodHalal') },
          ]}
          value={answers.food}
          onChange={(food) => set({ food })}
        />
      </Question>
      <Question title={t('inquiry.questions.liveStations')}>
        <View style={styles.chips}>
          {LIVE_STATIONS.map((station) => (
            <Chip
              key={station}
              label={t(`inquiry.questions.stations.${station}`)}
              selected={answers.liveStations.includes(station)}
              onPress={() =>
                set({
                  liveStations: answers.liveStations.includes(station)
                    ? answers.liveStations.filter((item) => item !== station)
                    : [...answers.liveStations, station],
                })
              }
            />
          ))}
        </View>
      </Question>
      <TextField
        label={t('inquiry.questions.whichHall')}
        hint={t('inquiry.questions.whichHallHint')}
        value={answers.hall}
        onChangeText={(hall) => set({ hall })}
        maxLength={80}
      />
      <Question title={t('inquiry.questions.tasting')}>
        <YesNo value={answers.tasting} onChange={(tasting) => set({ tasting })} />
      </Question>
    </>
  );
}

/** "When could you visit?": up to three dates, each morning, afternoon or evening. */
function TourSlots({
  slots,
  onChange,
}: {
  slots: TourSlot[];
  onChange: (slots: TourSlot[]) => void;
}) {
  const { t } = useLocale();
  // Match the app's light or dark setting, not the phone's (see ask.tsx)
  const scheme = useScheme();
  const [picking, setPicking] = useState<number | null>(null);
  const shown = slots.length > 0 ? slots : [{ date: null, part: 'morning' as DayPart }];
  const update = (index: number, patch: Partial<TourSlot>) =>
    onChange(shown.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  return (
    <Question title={t('inquiry.questions.tourSlots')}>
      <AppText color="text2">{t('inquiry.questions.tourSlotsHint')}</AppText>
      {shown.map((slot, index) => (
        <Card key={index} style={styles.slot}>
          <Button
            variant="secondary"
            icon="calendar-outline"
            label={slot.date ? formatDate(slot.date) : t('inquiry.pickDate')}
            onPress={() => setPicking(index)}
          />
          {picking === index && (
            <DateTimePicker
              value={slot.date ? fromDateString(slot.date) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              themeVariant={scheme}
              onChange={(event, picked) => {
                if (Platform.OS !== 'ios') setPicking(null);
                if (event.type === 'set' && picked) update(index, { date: toDateString(picked) });
              }}
            />
          )}
          {picking === index && Platform.OS === 'ios' && (
            <Button variant="text" label={t('location.done')} onPress={() => setPicking(null)} />
          )}
          <Choice
            options={(['morning', 'afternoon', 'evening'] as DayPart[]).map((part) => ({
              value: part,
              label: t(`inquiry.questions.parts.${part}`),
            }))}
            value={slot.part}
            onChange={(part) => update(index, { part: part ?? 'morning' })}
          />
        </Card>
      ))}
      {shown.length < MAX_TOUR_SLOTS && (
        <Button
          variant="text"
          icon="add-circle-outline"
          label={t('inquiry.questions.addTime')}
          onPress={() => onChange([...shown, { date: null, part: 'evening' }])}
        />
      )}
    </Question>
  );
}

const styles = StyleSheet.create({
  question: {
    gap: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slot: {
    gap: Spacing.md,
  },
});
