import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { makeStyles, Radius, Spacing } from '@/constants/theme';
import { useSetSiteCover, type SitePage } from '@/data/website';
import { askMediaAccess } from '@/features/reels/media-access';
import { siteDesign } from '@/features/website/designs';
import { SiteCover } from '@/features/website/site-cover';
import { closeWebsiteSheet, SheetForm, WebsiteSheet } from '@/features/website/website-sheet';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/** Pick the photo guests see first, shown in the site's design as it will look. */
export default function WebsiteCoverScreen() {
  const { t } = useLocale();
  return (
    <WebsiteSheet title={t('website.cover.title')}>
      {(site, weddingId) => <CoverForm site={site} weddingId={weddingId} />}
    </WebsiteSheet>
  );
}

function CoverForm({ site, weddingId }: { site: SitePage; weddingId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const setCover = useSetSiteCover(site.slug);
  const [width, setWidth] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const noPhotoDesign = siteDesign(site.design).cover === 'stars';

  const pick = async () => {
    const access = await askMediaAccess('library');
    if (access !== 'granted') {
      setBlocked(access === 'blocked');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setCover.mutate(
      { weddingId, photo: { uri: asset.uri, width: asset.width, height: asset.height } },
      { onSuccess: () => successHaptic() },
    );
  };

  return (
    <SheetForm
      saveLabel={t('website.done')}
      onSave={closeWebsiteSheet}
      error={setCover.isError ? t('website.cover.failed') : null}
    >
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        {width > 0 && (
          <View style={[styles.preview, { pointerEvents: 'none' }]}>
            <SiteCover data={site} width={width} mini id="cover-sheet" minHeight={440} />
          </View>
        )}
      </View>
      <AppText color="text2">
        {noPhotoDesign ? t('website.cover.smallInNoor') : t('website.cover.hint')}
      </AppText>
      <View style={styles.buttons}>
        <Button
          icon="image-outline"
          label={site.coverPath ? t('website.cover.change') : t('website.cover.choose')}
          loading={setCover.isPending}
          onPress={() => void pick()}
        />
        {setCover.isPending && (
          <AppText color="text2" style={styles.center} accessibilityLiveRegion="polite">
            {t('website.cover.adding')}
          </AppText>
        )}
        {blocked && (
          <Button
            variant="text"
            label={t('website.cover.openSettings')}
            onPress={() => void Linking.openSettings()}
          />
        )}
        {site.coverPath && !setCover.isPending && (
          <Button
            variant="text"
            labelColor="error"
            label={t('website.cover.remove')}
            onPress={() => setCover.mutate({ weddingId, photo: null })}
          />
        )}
      </View>
    </SheetForm>
  );
}

const useStyles = makeStyles((Colors) => ({
  preview: {
    height: 440,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  buttons: {
    gap: Spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
}));
