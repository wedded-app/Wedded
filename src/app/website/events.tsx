import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { eventIcon } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { Switch } from '@/components/switch';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useEvent } from '@/data/reference';
import { useSetEventSiteDetails, type SiteEvent, type SitePage } from '@/data/website';
import { formatTime } from '@/features/vendors/profile-format';
import { DRESS_COLORS } from '@/features/website/designs';
import { shortDay } from '@/features/website/site-helpers';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

type Draft = { dressCode: string; colors: string[]; note: string; shownPublicly: boolean };

const MOST_COLORS = 3;

/**
 * Each event on the site: what to wear (words and up to three colour
 * swatches), a note for guests, and whether everyone sees it or only the
 * guests invited to it. The day, time and place come from the plan.
 */
export default function WebsiteEventsScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.events.title')}>
      {(site, weddingId) => <EventsForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function draftOf(e: SiteEvent): Draft {
  return {
    dressCode: e.dressCode ?? '',
    colors: e.dressColors,
    note: e.note ?? '',
    shownPublicly: e.shownPublicly,
  };
}

function EventsForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const setDetails = useSetEventSiteDetails(site.slug);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(site.events.map((e) => [e.slug, draftOf(e)])),
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      for (const e of site.events) {
        const was = draftOf(e);
        const now = drafts[e.slug];
        if (!now || JSON.stringify(was) === JSON.stringify(now)) continue;
        await setDetails.mutateAsync({
          weddingId,
          eventSlug: e.slug,
          details: {
            dress_code: now.dressCode,
            dress_colors: now.colors,
            guest_note: now.note,
            shown_publicly: now.shownPublicly,
          },
        });
      }
      successHaptic();
      closeWebsiteSheet();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetForm
      onSave={() => void save()}
      saving={saving}
      error={failed ? t('website.saveFailed') : null}
    >
      <AppText color="text2">{t('website.events.hint')}</AppText>
      {site.events.length === 0 && <AppText>{t('website.events.none')}</AppText>}
      {site.events.map((e) => (
        <EventEditor
          key={e.slug}
          event={e}
          draft={drafts[e.slug] ?? draftOf(e)}
          onChange={(d) => setDrafts((all) => ({ ...all, [e.slug]: d }))}
        />
      ))}
    </SheetForm>
  );
}

function EventEditor({
  event,
  draft,
  onChange,
}: {
  event: SiteEvent;
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  const styles = useStyles();
  const Colors = useColors();
  const { t } = useLocale();
  const details = useEvent(event.slug);
  const name = details.data ? localized(details.data.name) : '';
  const when = [
    event.date ? shortDay(event.date) : t('website.events.noDay'),
    event.startsAt && formatTime(event.startsAt.slice(0, 5)),
    event.place,
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleColor = (hex: string) => {
    selectionHaptic();
    const on = draft.colors.includes(hex);
    if (!on && draft.colors.length >= MOST_COLORS) return;
    onChange({
      ...draft,
      colors: on ? draft.colors.filter((c) => c !== hex) : [...draft.colors, hex],
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name={eventIcon(event.slug)} size={22} color={Colors.primary} />
        </View>
        <View style={styles.grow}>
          <AppText variant="heading">{name}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {when}
          </AppText>
        </View>
      </View>
      <Button
        variant="text"
        icon="create-outline"
        label={t('website.events.changeWhen')}
        onPress={() => router.push('/guest-details')}
      />
      <TextField
        label={t('website.events.wear')}
        value={draft.dressCode}
        onChangeText={(dressCode) => onChange({ ...draft, dressCode })}
        placeholder={t('website.events.wearSample')}
        multiline
        maxLength={200}
      />
      <View style={styles.block}>
        <AppText variant="label" weight={600}>
          {t('website.events.colors')}
        </AppText>
        <View style={styles.swatches}>
          {DRESS_COLORS.map((c) => {
            const on = draft.colors.includes(c.hex);
            return (
              <Pressable
                key={c.hex}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(c.nameKey)}
                onPress={() => toggleColor(c.hex)}
                hitSlop={4}
                style={[styles.swatchRing, on && { borderColor: Colors.text }]}
              >
                <View style={[styles.swatch, { backgroundColor: c.hex }]}>
                  {on && (
                    <Icon
                      name="checkmark"
                      size={16}
                      color={
                        ['#F4EDE1', '#F2C230', '#D9B26A', '#9AA0A6'].includes(c.hex)
                          ? '#141214'
                          : '#FFFFFF'
                      }
                      weight="bold"
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" color="text2">
          {t('website.events.colorsHint')}
        </AppText>
      </View>
      <TextField
        label={t('website.events.note')}
        value={draft.note}
        onChangeText={(note) => onChange({ ...draft, note })}
        placeholder={t('website.events.noteSample')}
        multiline
        maxLength={300}
      />
      <View style={styles.switchRow}>
        <View style={styles.grow}>
          <AppText weight={600}>{t('website.events.everyone')}</AppText>
          <AppText variant="label" weight={400} color="text2">
            {draft.shownPublicly ? t('website.events.everyoneOn') : t('website.events.everyoneOff')}
          </AppText>
        </View>
        <Switch
          value={draft.shownPublicly}
          onValueChange={(shownPublicly) => onChange({ ...draft, shownPublicly })}
          accessibilityLabel={t('website.events.everyone')}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  block: {
    gap: Spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
}));
