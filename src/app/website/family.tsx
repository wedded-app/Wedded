import { useState } from 'react';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useUpdateSite, type SitePage } from '@/data/website';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const MOST_LINES = 4;

/** "With the blessings of" and up to four lines of family names, usually each side's parents. */
export default function WebsiteFamilyScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.family.title')}>
      {(site, weddingId) => <FamilyForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function FamilyForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const { t } = useLocale();
  const update = useUpdateSite(site.slug);
  const [heading, setHeading] = useState(site.familyTitle ?? '');
  const [lines, setLines] = useState<string[]>(
    site.familyLines.length > 0 ? site.familyLines : ['', ''],
  );

  const save = () =>
    update.mutate(
      {
        weddingId,
        changes: { family_title: heading, family_lines: lines, sections: withFamily(site) },
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
      <TextField
        label={t('website.family.heading')}
        hint={t('website.family.headingHint')}
        value={heading}
        onChangeText={setHeading}
        placeholder={t('website.site.familyTitle')}
        maxLength={60}
      />
      {lines.map((line, i) => (
        <TextField
          key={i}
          label={t('website.family.line', { number: i + 1 })}
          type="name"
          value={line}
          onChangeText={(value) => setLines((all) => all.map((l, j) => (j === i ? value : l)))}
          placeholder={i % 2 === 0 ? t('website.family.sampleA') : t('website.family.sampleB')}
          maxLength={120}
        />
      ))}
      {lines.length < MOST_LINES && (
        <Button
          variant="neutral"
          icon="add-circle-outline"
          label={t('website.family.addLine')}
          onPress={() => setLines((all) => [...all, ''])}
        />
      )}
    </SheetForm>
  );
}

/** Writing family names switches the part on, so it shows. */
function withFamily(site: SitePage) {
  return site.sections.includes('family') ? site.sections : ['family' as const, ...site.sections];
}
