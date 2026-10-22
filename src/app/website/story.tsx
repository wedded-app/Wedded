import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/text-field';
import { useUpdateSite, type SitePage } from '@/data/website';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** "Our story": how they met, the proposal, in their own words. */
export default function WebsiteStoryScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.story.title')}>
      {(site, weddingId) => <StoryForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function StoryForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [story, setStory] = useState(site.story ?? '');

  const save = () =>
    update.mutate(
      {
        weddingId,
        changes: {
          story,
          sections: site.sections.includes('story') ? site.sections : [...site.sections, 'story'],
        },
      },
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
      <AppText color="text2">{t('website.story.hint')}</AppText>
      <TextField
        label={t('website.story.label')}
        value={story}
        onChangeText={setStory}
        placeholder={t('website.story.sample')}
        multiline
        maxLength={3000}
        style={{ minHeight: 220 }}
      />
    </SheetForm>
  );
}
