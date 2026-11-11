import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { switchToBusiness } from '@/features/business/app-mode';
import { PillButton } from '@/features/onboarding/onboarding-step';
import { KIND_PHOTOS } from '@/features/search/kind-photos';
import { resetJoinDraft, townChoice, useJoinDraft } from '@/features/vendor-join/join-draft';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

const NEXT: { key: 'photos' | 'review' | 'found'; icon: IconName }[] = [
  { key: 'photos', icon: 'images-outline' },
  { key: 'review', icon: 'shield-checkmark-outline' },
  { key: 'found', icon: 'chatbubbles-outline' },
];

/**
 * List your business, the end: their page is made (a draft only they can
 * see), shown as its photo, name, kind and town, with what happens next in
 * three plain lines, and one pill to the business side, where they add
 * photos and prices. No Back: the page exists now.
 */
export default function ReadyStep() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const draft = useJoinDraft();
  const categories = useCategories();
  const cities = useCities();
  const kind = categories.data?.find((category) => category.slug === draft.categorySlug);
  const town = cities.data ? townChoice(cities.data, draft.town, draft.citySlug).picked : null;
  const photo = kind ? KIND_PHOTOS[kind.slug] : undefined;
  const details = [kind ? localized(kind.name) : null, town?.name ?? null].filter(Boolean);

  return (
    <Screen edges={['top', 'bottom']} plain>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.photo}>
            {photo ? (
              <Image source={photo} contentFit="cover" style={styles.fill} accessible={false} />
            ) : (
              <Icon
                name={kind ? groupIcon(kind.groupSlug) : 'storefront-outline'}
                size={40}
                color={Colors.text2}
              />
            )}
          </View>
          <View style={styles.center}>
            <AppText variant="heading" style={styles.centerText}>
              {draft.name.trim()}
            </AppText>
            {details.length > 0 && (
              <AppText color="text2" style={styles.centerText}>
                {details.join(' · ')}
              </AppText>
            )}
          </View>
          <View style={styles.tag}>
            <AppText variant="caption" weight={600} color="text2">
              {t('vendorJoin.ready.tag')}
            </AppText>
          </View>
        </View>

        <AppText variant="display" weight={700} accessibilityRole="header" style={styles.title}>
          {t('vendorJoin.ready.title')}
        </AppText>

        <View>
          {NEXT.map(({ key, icon }, index) => (
            <View
              key={key}
              style={[styles.row, index > 0 && styles.divider]}
              accessible
              accessibilityLabel={`${t(`vendorJoin.ready.next.${key}.title`)}. ${t(`vendorJoin.ready.next.${key}.body`)}`}
            >
              <Icon name={icon} size={24} color={Colors.text} />
              <View style={styles.rowText}>
                <AppText weight={700}>{t(`vendorJoin.ready.next.${key}.title`)}</AppText>
                <AppText variant="label" weight={400} color="text2">
                  {t(`vendorJoin.ready.next.${key}.body`)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={t('vendorJoin.ready.open')}
          onPress={() => {
            resetJoinDraft();
            switchToBusiness();
          }}
        />
      </View>
    </Screen>
  );
}

const PHOTO = 112;

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  page: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.button,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Colors.separator,
  },
  title: {
    letterSpacing: -0.5,
    paddingHorizontal: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
}));
