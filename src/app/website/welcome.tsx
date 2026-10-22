import { useState } from 'react';

import { TextField } from '@/components/text-field';
import { useUpdateSite, type SitePage } from '@/data/website';
import { usePlanView } from '@/features/planner/use-plan-view';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** The cover's words: the couple's names (the plan's, so cards and RSVPs match) and a welcome line. */
export default function WebsiteWelcomeScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.welcome.title')}>
      {(site, weddingId) => <WelcomeForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function WelcomeForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const view = usePlanView();
  const update = useUpdateSite(site.slug);
  const [names, setNames] = useState(site.title);
  const [welcome, setWelcome] = useState(site.welcome ?? '');

  const save = () => {
    const title = names.trim().replace(/\s+/g, ' ') || null;
    if (title !== site.title) view.setTitle(title);
    update.mutate(
      { weddingId, changes: { welcome } },
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
      error={update.isError ? t('website.saveFailed') : null}
    >
      <TextField
        label={t('website.welcome.names')}
        hint={t('website.welcome.namesHint')}
        type="name"
        value={names}
        onChangeText={setNames}
        placeholder={t('cards.namesSample')}
        maxLength={80}
      />
      <TextField
        label={t('website.welcome.line')}
        hint={t('website.welcome.lineHint')}
        value={welcome}
        onChangeText={setWelcome}
        placeholder={t('website.welcome.lineSample')}
        multiline
        maxLength={300}
      />
    </SheetForm>
  );
}
