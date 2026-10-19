import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { FieldError } from '@/components/field-error';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { CARD_DESIGNS, cardDate, type CardText } from '@/features/cards/card-designs';
import { printCards, saveCard, shareCard } from '@/features/cards/card-export';
import { InvitationCard } from '@/features/cards/invitation-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Action = 'save' | 'share' | 'print';

/**
 * Invitation cards (from My Wedding): pick a look, pick one of the plan's
 * events to fill in its name and day, type the rest, and watch the card
 * change above. Then save it to Photos, share it (WhatsApp, Messages) or
 * print it. Nothing is uploaded: the card stays on the phone until it's sent.
 * Wed will write the wording once it's live (#129).
 */
export default function CardsScreen() {
  const { t } = useLocale();
  const { plan, chosen, wedding } = usePlanView();
  const card = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [designId, setDesignId] = useState(CARD_DESIGNS[0].id);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [text, setText] = useState<CardText>(() => ({
    opening: t('cards.defaults.opening'),
    // The couple's names from Invitation details, so the guest list and the cards match
    names: wedding?.title ?? '',
    invite: t('cards.defaults.invite'),
    event: '',
    date: null,
    time: '',
    venue: '',
    note: '',
  }));
  const [busy, setBusy] = useState<Action | null>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<Action | null>(null);

  const design = CARD_DESIGNS.find((d) => d.id === designId) ?? CARD_DESIGNS[0];
  const edit = (change: Partial<CardText>) => {
    setDone(false);
    setText((current) => ({ ...current, ...change }));
  };

  async function run(action: Action) {
    setBusy(action);
    setDone(false);
    setFailed(null);
    try {
      if (action === 'save') {
        if (!(await saveCard(card))) throw new Error('not_saved');
        successHaptic();
        setDone(true);
      } else if (action === 'share') {
        await shareCard(card, t('cards.shareTitle'));
      } else {
        await printCards([card]);
      }
    } catch {
      setFailed(action);
    } finally {
      setBusy(null);
    }
  }

  const ready = text.names.trim().length > 0;

  return (
    <NavScreen
      title={t('cards.title')}
      subtitle={t('cards.subtitle')}
      // The box being typed in stays above the keyboard
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={styles.preview}
        onLayout={(e) => setWidth(Math.min(e.nativeEvent.layout.width, 420))}
      >
        {width > 0 && (
          <InvitationCard
            ref={card}
            design={design}
            text={text}
            namesSample={t('cards.namesSample')}
            width={width}
          />
        )}
      </View>

      <View style={styles.group}>
        <SectionTitle>{t('cards.design')}</SectionTitle>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {CARD_DESIGNS.map((d) => (
            <Chip
              key={d.id}
              role="radio"
              label={t(d.nameKey)}
              selected={d.id === designId}
              onPress={() => setDesignId(d.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <SectionTitle>{t('cards.words')}</SectionTitle>
        <TextField
          label={t('cards.names')}
          placeholder={t('cards.namesSample')}
          type="name"
          value={text.names}
          onChangeText={(names) => edit({ names })}
          maxLength={60}
        />
        {chosen.length > 0 && (
          <View style={styles.field}>
            <AppText weight={600}>{t('cards.whichEvent')}</AppText>
            <AppText variant="label" weight={400} color="text2">
              {t('cards.whichEventHint')}
            </AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {chosen.map((event) => (
                <Chip
                  key={event.slug}
                  role="radio"
                  label={localized(event.name)}
                  selected={eventSlug === event.slug}
                  onPress={() => {
                    setEventSlug(event.slug);
                    edit({
                      event: localized(event.name),
                      date: plan.eventDates?.[event.slug] ?? null,
                    });
                  }}
                />
              ))}
            </View>
          </View>
        )}
        <TextField
          label={t('cards.event')}
          placeholder={t('cards.eventSample')}
          value={text.event}
          onChangeText={(event) => edit({ event })}
          maxLength={40}
        />
        <View style={styles.field}>
          <AppText weight={600}>{t('cards.date')}</AppText>
          <DateField
            value={text.date}
            onChange={(date) => {
              selectionHaptic();
              edit({ date });
            }}
            placeholder={text.date ? cardDate(text.date) : t('cards.datePick')}
          />
          {text.date && (
            <Button
              variant="text"
              label={t('cards.dateClear')}
              onPress={() => edit({ date: null })}
            />
          )}
        </View>
        <TextField
          label={t('cards.time')}
          placeholder={t('cards.timeSample')}
          value={text.time}
          onChangeText={(time) => edit({ time })}
          maxLength={40}
        />
        <TextField
          label={t('cards.venue')}
          placeholder={t('cards.venueSample')}
          value={text.venue}
          onChangeText={(venue) => edit({ venue })}
          maxLength={120}
        />
        <TextField
          label={t('cards.note')}
          hint={t('cards.noteHint')}
          placeholder={t('cards.noteSample')}
          value={text.note}
          onChangeText={(note) => edit({ note })}
          maxLength={140}
          multiline
        />
        <TextField
          label={t('cards.opening')}
          value={text.opening}
          onChangeText={(opening) => edit({ opening })}
          maxLength={60}
        />
        <TextField
          label={t('cards.invite')}
          value={text.invite}
          onChangeText={(invite) => edit({ invite })}
          maxLength={60}
        />
      </View>

      <View style={styles.group}>
        {!ready && (
          <AppText color="text2" style={styles.pad}>
            {t('cards.needNames')}
          </AppText>
        )}
        <Button
          icon="images-outline"
          label={t('cards.save')}
          disabled={!ready || busy !== null}
          loading={busy === 'save'}
          onPress={() => void run('save')}
        />
        <Button
          variant="secondary"
          icon="share-outline"
          label={t('cards.share')}
          disabled={!ready || busy !== null}
          loading={busy === 'share'}
          onPress={() => void run('share')}
        />
        <Button
          variant="secondary"
          icon="print-outline"
          label={t('cards.print')}
          disabled={!ready || busy !== null}
          loading={busy === 'print'}
          onPress={() => void run('print')}
        />
        {done && (
          <AppText color="success" weight={600} style={styles.pad} accessibilityLiveRegion="polite">
            {t('cards.saved')}
          </AppText>
        )}
        {failed && <FieldError message={t(`cards.failed.${failed}`)} />}
        <AppText variant="label" weight={400} color="text2" style={styles.pad}>
          {t('cards.private')}
        </AppText>
      </View>
    </NavScreen>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
  },
  group: {
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
  },
});
