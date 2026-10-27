import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/text-field';
import { httpsLink, useUpdateSite, type SitePage } from '@/data/website';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** A link to watch the ceremony, for family who can't come (often abroad). */
export default function WebsiteLivestreamScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.live.title')}>
      {(site, weddingId) => <LiveForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function LiveForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [url, setUrl] = useState(site.livestreamUrl ?? '');
  const [note, setNote] = useState(site.livestreamNote ?? '');

  const save = () => {
    const link = httpsLink(url);
    update.mutate(
      {
        weddingId,
        changes: {
          livestream_url: link,
          livestream_note: note,
          sections:
            link && !site.sections.includes('livestream')
              ? [...site.sections, 'livestream']
              : site.sections,
        },
      },
      {
        onSuccess: () => {
          successHaptic();
          closeWebsiteSheet();
        },
      },
    );
  };

  return (
    <SheetForm
      onSave={save}
      saving={update.isPending}
      error={update.isError ? t('website.live.badLink') : null}
    >
      <AppText color="text2">{t('website.live.hint')}</AppText>
      <TextField
        label={t('website.live.link')}
        value={url}
        onChangeText={setUrl}
        placeholder={t('website.live.linkSample')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />
      <TextField
        label={t('website.live.note')}
        value={note}
        onChangeText={setNote}
        placeholder={t('website.live.noteSample')}
        multiline
        maxLength={200}
      />
    </SheetForm>
  );
}
