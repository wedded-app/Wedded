import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { ListRow, ListSection } from '@/components/list';
import { Spacing } from '@/constants/theme';
import { useUpdateSite, type SitePage } from '@/data/website';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * RSVPs on the site: the reply-by date, and where answers go (the guest
 * list). Guests answer on their own RSVP page; on the site, a guest without
 * their own link types their phone number to find it.
 */
export default function WebsiteRsvpScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.rsvp.title')}>
      {(site, weddingId) => <RsvpForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function RsvpForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [replyBy, setReplyBy] = useState<string | null>(site.rsvpBy);

  const save = () =>
    update.mutate(
      { weddingId, changes: { rsvp_by: replyBy } },
      {
        onSuccess: () => {
          successHaptic();
          closeWebsiteSheet();
        },
      },
    );

  return (
    <SheetForm
      onSave={save}
      saving={update.isPending}
      error={update.isError ? t('website.saveFailed') : null}
    >
      <AppText color="text2">{t('website.rsvp.hint')}</AppText>
      <View style={{ gap: Spacing.sm }}>
        <AppText variant="label" weight={600}>
          {t('website.rsvp.replyBy')}
        </AppText>
        <DateField value={replyBy} onChange={setReplyBy} placeholder={t('website.rsvp.pickDate')} />
        {replyBy && (
          <Button
            variant="text"
            label={t('website.rsvp.noDate')}
            onPress={() => setReplyBy(null)}
          />
        )}
      </View>
      <ListSection footer={site.rsvpLink ? t('website.rsvp.linkOn') : t('website.rsvp.linkOff')}>
        <ListRow
          icon="people-outline"
          title={t('website.rsvp.guestList')}
          subtitle={t('website.rsvp.guestListHint')}
          onPress={() => router.push('/guests')}
        />
      </ListSection>
    </SheetForm>
  );
}
