import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { NextButton, PillButton, ProgressBar } from '@/features/onboarding/onboarding-step';
import { KIND_PHOTOS } from '@/features/search/kind-photos';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { JOIN_STEPS, joinProgress, townChoice, useJoinDraft, type JoinStep } from './join-draft';

export type JoinQuestionProps = {
  step: JoinStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The arrow is grey until this is true. */
  canContinue: boolean;
  onContinue: () => void;
  /** The last question ends on a labelled pill ("Make my page") instead of the arrow. */
  finishLabel?: string;
  loading?: boolean;
  error?: string;
};

/**
 * One question of List your business, laid out like the first questions a
 * family answers (Hinge's): Back and one thin bar at the top, the question
 * big and bold, the answer under it, and at the bottom their page as it's
 * taking shape beside the round arrow. It follows the phone's light or dark
 * setting, and the bottom rises with the keyboard so the arrow stays in reach.
 */
export function JoinQuestion({
  step,
  title,
  subtitle,
  children,
  canContinue,
  onContinue,
  finishLabel,
  loading = false,
  error,
}: JoinQuestionProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const progress = joinProgress(step);

  return (
    <Screen edges={['top', 'bottom']} plain>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            onPress={() => {
              selectionHaptic();
              if (router.canGoBack()) router.back();
              else router.replace('/for-vendors');
            }}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <Icon name="chevron-back" size={26} color={Colors.text} weight="semibold" />
          </Pressable>
          <ProgressBar
            from={progress.from}
            to={progress.to}
            label={t('onboarding.stepOf', {
              step: JOIN_STEPS.indexOf(step) + 1,
              total: JOIN_STEPS.length,
            })}
          />
          <View style={styles.side} />
        </View>

        <ScrollView
          style={styles.grow}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <AppText variant="display" weight={700} accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            {subtitle && (
              <AppText variant="bodyLg" color="text2">
                {subtitle}
              </AppText>
            )}
          </View>
          {children}
          {error && <FieldError message={error} />}
        </ScrollView>

        {finishLabel ? (
          <View style={styles.finish}>
            <PagePreview />
            <PillButton
              label={finishLabel}
              disabled={!canContinue}
              loading={loading}
              onPress={onContinue}
            />
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.grow}>
              <PagePreview />
            </View>
            <NextButton
              label={t('onboarding.continue')}
              disabled={!canContinue}
              loading={loading}
              onPress={onContinue}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Their page so far, small, the way families will see it in a list: the
 * photo of what they do (or its icon), the name, then what and where. It
 * fills in as they answer, so by the last question they've watched it form.
 */
function PagePreview() {
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
    <View
      style={styles.preview}
      accessible
      accessibilityLabel={t('vendorJoin.previewSpoken', {
        name: draft.name.trim() || t('vendorJoin.previewName'),
        details: details.join(', '),
      })}
    >
      <View style={styles.thumb}>
        {photo ? (
          <Image source={photo} contentFit="cover" style={styles.fill} accessible={false} />
        ) : (
          <Icon
            name={kind ? groupIcon(kind.groupSlug) : 'storefront-outline'}
            size={20}
            color={Colors.text2}
          />
        )}
      </View>
      <View style={styles.grow}>
        <AppText weight={700} numberOfLines={1} color={draft.name.trim() ? 'text' : 'text2'}>
          {draft.name.trim() || t('vendorJoin.previewName')}
        </AppText>
        <AppText variant="label" weight={400} color="text2" numberOfLines={1}>
          {details.length > 0 ? details.join(' · ') : t('vendorJoin.previewEmpty')}
        </AppText>
      </View>
    </View>
  );
}

const THUMB = 44;

const useStyles = makeStyles((Colors) => ({
  grow: {
    flex: 1,
  },
  bar: {
    minHeight: Sizes.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  side: {
    width: 44 - Spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  finish: {
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
}));
