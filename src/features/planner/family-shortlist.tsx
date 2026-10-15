import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { SectionTitle } from '@/components/list';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import {
  REACTIONS,
  useFamilyShortlist,
  useReact,
  type Reaction,
  type ShortlistVendor,
} from '@/data/family-shortlist';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

const REACTION_ICON: Record<Reaction, { off: IconName; on: IconName }> = {
  love: { off: 'heart-outline', on: 'heart' },
  maybe: { off: 'help-circle-outline', on: 'help-circle' },
  no: { off: 'close-circle-outline', on: 'close-circle' },
};

/**
 * The family shortlist on My Wedding (docs/RESEARCH_GROWTH.md #2): every
 * vendor anyone in the shared plan saved, who saved it, and everyone's
 * reactions. Tap Love it / Maybe / Not for us; tap again to take it back.
 */
export function FamilyShortlist({ weddingId }: { weddingId: string }) {
  const styles = useStyles();
  const { t } = useLocale();
  const shortlist = useFamilyShortlist(weddingId);

  if (!shortlist.data || shortlist.data.length === 0) {
    return shortlist.data ? (
      <View style={styles.block}>
        <SectionTitle>{t('familyShortlist.title')}</SectionTitle>
        <AppText color="text2" style={styles.pad}>
          {t('familyShortlist.empty')}
        </AppText>
      </View>
    ) : null;
  }

  return (
    <View style={styles.block}>
      <SectionTitle>{t('familyShortlist.title')}</SectionTitle>
      <AppText color="text2" style={styles.pad}>
        {t('familyShortlist.hint')}
      </AppText>
      {shortlist.data.filter((v) => v.published).length >= 2 && (
        <Button
          variant="text"
          icon="git-compare-outline"
          label={t('compare.button', {
            count: Math.min(shortlist.data.filter((v) => v.published).length, 3),
          })}
          onPress={() =>
            router.push({
              pathname: '/compare',
              params: {
                vendors: shortlist.data
                  .filter((v) => v.published)
                  .map((v) => v.slug)
                  .join(','),
              },
            })
          }
        />
      )}
      {shortlist.data.map((vendor) => (
        <ShortlistCard key={vendor.vendorId} vendor={vendor} weddingId={weddingId} />
      ))}
    </View>
  );
}

function ShortlistCard({ vendor, weddingId }: { vendor: ShortlistVendor; weddingId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const react = useReact(weddingId);
  const name = localized(vendor.name);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        disabled={!vendor.published}
        onPress={() => router.push(`/v/${vendor.slug}` as Href)}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.grow}>
          <AppText variant="bodyLg" weight={600}>
            {name}
          </AppText>
          <AppText variant="label" weight={400} color="text2">
            {vendor.published
              ? t('familyShortlist.savedBy', { names: vendor.savedBy.join(', ') })
              : t('saved.noLongerListed')}
          </AppText>
          {vendor.lovedBy.length > 0 && (
            <AppText variant="label" weight={600} color="primary">
              {t('familyShortlist.lovedBy', { names: vendor.lovedBy.join(', ') })}
            </AppText>
          )}
        </View>
        {vendor.published && (
          <Icon name="chevron-forward" size={18} color={Colors.chevron} weight="semibold" />
        )}
      </Pressable>
      <View style={styles.reactions} accessibilityRole="radiogroup">
        {REACTIONS.map((reaction) => {
          const mine = vendor.myReaction === reaction;
          const count = vendor.counts[reaction];
          return (
            <Pressable
              key={reaction}
              accessibilityRole="radio"
              accessibilityState={{ checked: mine }}
              accessibilityLabel={`${t(`familyShortlist.reactions.${reaction}`)}, ${count}`}
              onPress={() => {
                selectionHaptic();
                react.mutate({ vendorId: vendor.vendorId, reaction: mine ? null : reaction });
              }}
              style={({ pressed }) => [
                styles.reaction,
                mine && styles.reactionMine,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={mine ? REACTION_ICON[reaction].on : REACTION_ICON[reaction].off}
                size={20}
                color={mine ? Colors.onPrimary : Colors.primary}
              />
              <AppText variant="label" weight={600} color={mine ? 'onPrimary' : 'text'}>
                {t(`familyShortlist.reactions.${reaction}`)}
                {count > 0 ? ` · ${count}` : ''}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.lg,
  },
  pad: {
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.sm,
  },
  card: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  reaction: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryTint,
  },
  reactionMine: {
    backgroundColor: Colors.primaryFill,
  },
}));
