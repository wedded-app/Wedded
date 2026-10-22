import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { ListRow, ListSection } from '@/components/list';
import { Switch } from '@/components/switch';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import {
  siteProblem,
  usePublishSite,
  useSetSitePassword,
  useSetSiteSlug,
  useUpdateSite,
  websiteLink,
  type SitePage,
} from '@/data/website';
import { confirm } from '@/features/guests/pick-sheet';
import { slugify } from '@/features/website/site-helpers';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** The site's link, its password, search engines, and taking it down. */
export default function WebsiteSettingsScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.settings.title')}>
      {(site, weddingId) => <SettingsForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function SettingsForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const setSlug = useSetSiteSlug();
  const setPassword = useSetSitePassword(site.slug);
  const update = useUpdateSite(site.slug);
  const publish = usePublishSite(site.slug);
  const [slug, setSlugText] = useState(site.slug);
  const [password, setPasswordText] = useState('');
  const [slugProblem, setSlugProblem] = useState<string | null>(null);
  const [passwordProblem, setPasswordProblem] = useState<string | null>(null);
  const hasPassword = !!site.editor?.hasPassword;
  const live = !!site.publishedAt;
  const typedSlug = slugify(slug);

  const saveSlug = () => {
    setSlugProblem(null);
    setSlug.mutate(
      { weddingId, slug },
      {
        onSuccess: (newSlug) => {
          successHaptic();
          setSlugText(newSlug);
          closeWebsiteSheet();
        },
        onError: (e) => {
          const p = siteProblem(e);
          setSlugProblem(
            p === 'slugTaken'
              ? t('website.settings.slugTaken')
              : p === 'invalidSlug'
                ? t('website.settings.slugInvalid')
                : t('website.saveFailed'),
          );
        },
      },
    );
  };
  const changeSlug = () =>
    live
      ? confirm(
          t('website.settings.slugWarnTitle'),
          t('website.settings.slugWarn'),
          t('website.settings.slugChange'),
          t('common.close'),
          saveSlug,
        )
      : saveSlug();

  const savePassword = (value: string) => {
    setPasswordProblem(null);
    setPassword.mutate(
      { weddingId, password: value },
      {
        onSuccess: () => {
          successHaptic();
          setPasswordText('');
        },
        onError: (e) =>
          setPasswordProblem(
            siteProblem(e) === 'invalidPassword'
              ? t('website.settings.passwordShort')
              : t('website.saveFailed'),
          ),
      },
    );
  };

  return (
    <SheetForm saveLabel={t('website.done')} onSave={closeWebsiteSheet}>
      <View style={styles.block}>
        <AppText variant="heading">{t('website.settings.link')}</AppText>
        <AppText color="text2">{t('website.settings.linkHint')}</AppText>
        <TextField
          label={t('website.settings.linkLabel')}
          value={slug}
          onChangeText={setSlugText}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
          error={slugProblem ?? undefined}
        />
        <View style={styles.linkBox}>
          <AppText variant="label" color="text2" selectable>
            {websiteLink(typedSlug || site.slug)}
          </AppText>
        </View>
        {typedSlug !== site.slug && (
          <Button
            variant="secondary"
            label={t('website.settings.saveLink')}
            loading={setSlug.isPending}
            onPress={changeSlug}
          />
        )}
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t('website.settings.password')}</AppText>
        <AppText color="text2">
          {hasPassword ? t('website.settings.passwordOn') : t('website.settings.passwordOff')}
        </AppText>
        <TextField
          label={
            hasPassword ? t('website.settings.newPassword') : t('website.settings.passwordLabel')
          }
          value={password}
          onChangeText={setPasswordText}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={64}
        />
        {passwordProblem && <FieldError message={passwordProblem} />}
        {password.trim().length > 0 && (
          <Button
            variant="secondary"
            label={t('website.settings.setPassword')}
            loading={setPassword.isPending}
            onPress={() => savePassword(password)}
          />
        )}
        {hasPassword && (
          <Button
            variant="text"
            labelColor="error"
            label={t('website.settings.removePassword')}
            onPress={() => savePassword('')}
          />
        )}
      </View>

      <ListSection>
        <ListRow
          icon="search-outline"
          title={t('website.settings.search')}
          subtitle={t('website.settings.searchHint')}
          trailing={
            <Switch
              value={site.searchable}
              onValueChange={(v) => update.mutate({ weddingId, changes: { searchable: v } })}
              accessibilityLabel={t('website.settings.search')}
            />
          }
        />
      </ListSection>

      {live && (
        <View style={styles.block}>
          <AppText variant="heading">{t('website.settings.takeDown')}</AppText>
          <AppText color="text2">{t('website.settings.takeDownHint')}</AppText>
          <Button
            variant="danger"
            label={t('website.settings.takeDownButton')}
            loading={publish.isPending}
            onPress={() =>
              confirm(
                t('website.settings.takeDown'),
                t('website.settings.takeDownHint'),
                t('website.settings.takeDownButton'),
                t('common.close'),
                () => publish.mutate({ weddingId, publish: false }),
              )
            }
          />
        </View>
      )}
    </SheetForm>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.sm,
  },
  linkBox: {
    padding: Spacing.md,
    borderRadius: Radius.field,
    backgroundColor: Colors.surface,
  },
}));
