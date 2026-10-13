import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useFamilyShortlist } from '@/data/family-shortlist';
import { useWeddingMembers } from '@/data/wedding';
import { useWeddingSuggestions } from '@/data/wedding-suggestions';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { familyActivity, joinNames, type FamilyActivity } from './home-feed';
import { SectionHeader } from './section-header';

/**
 * Your family: who's planning (their initials and a count) and what they've
 * been doing, the latest suggestions and the vendors they love, each opening
 * that vendor. Planning alone, it's an invitation to bring the family in,
 * which opens Plan together on My Wedding.
 */
export function YourFamily({
  weddingId,
  eventName,
}: {
  weddingId: string;
  eventName: (slug: string) => string;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const members = useWeddingMembers(weddingId);
  const shortlist = useFamilyShortlist(weddingId);
  const suggestions = useWeddingSuggestions(weddingId);
  const people = useMemo(() => members.data ?? [], [members.data]);
  const activity = useMemo(
    () => familyActivity(shortlist.data ?? [], suggestions.data ?? [], people),
    [shortlist.data, suggestions.data, people],
  );

  if (members.isPending) return null;
  const openPlan = () => router.push('/plan');

  if (people.length <= 1) {
    return (
      <View style={styles.block}>
        <SectionHeader title={t('home.yourFamily')} />
        <View style={styles.invite}>
          <View style={styles.inviteIcon}>
            <Icon name="people" size={28} color={Colors.primary} />
          </View>
          <View style={styles.inviteWords}>
            <AppText variant="heading" weight={700}>
              {t('home.inviteTitle')}
            </AppText>
            <AppText color="text2">{t('home.inviteBody')}</AppText>
          </View>
          <PressableScale accessibilityRole="button" onPress={openPlan} style={styles.inviteButton}>
            <Icon name="person-add-outline" size={18} color={Colors.onPrimary} />
            <AppText variant="label" weight={700} color="onPrimary">
              {t('home.inviteButton')}
            </AppText>
          </PressableScale>
        </View>
      </View>
    );
  }

  const describe = (item: FamilyActivity) =>
    item.kind === 'loved'
      ? t('home.loved', {
          names: joinNames(item.names, t('home.and')),
          vendor: localized(item.vendor.name, locale),
        })
      : t('home.suggested', {
          name: item.name ?? t('home.someone'),
          vendor: localized(item.vendor.name, locale),
          event: eventName(item.eventSlug),
        });

  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.yourFamily')} link={t('home.planTogether')} onLink={openPlan} />
      <View style={styles.people}>
        <View style={styles.faces}>
          {people.slice(0, 5).map((person, index) => (
            <View
              key={person.userId}
              style={[styles.face, index > 0 && styles.overlap]}
              accessible={false}
            >
              <AppText variant="label" weight={700} color="primary">
                {(person.name ?? '?').trim().charAt(0).toUpperCase()}
              </AppText>
            </View>
          ))}
        </View>
        <AppText weight={600}>{t('home.planningCount', { count: people.length })}</AppText>
      </View>
      {activity.length === 0 ? (
        <AppText color="text2" style={styles.quiet}>
          {t('home.familyEmpty')}
        </AppText>
      ) : (
        <ListSection>
          {activity.map((item) => (
            <ListRow
              key={item.key}
              title={describe(item)}
              icon={item.kind === 'loved' ? 'heart' : 'sparkles'}
              iconColor={item.kind === 'loved' ? 'pink' : 'primary'}
              onPress={() =>
                router.push({ pathname: '/v/[slug]', params: { slug: item.vendor.slug } })
              }
            />
          ))}
        </ListSection>
      )}
    </View>
  );
}

const FACE = 36;

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  invite: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  inviteIcon: {
    width: Sizes.iconCircle,
    height: Sizes.iconCircle,
    borderRadius: Sizes.iconCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  inviteWords: {
    gap: Spacing.xs,
  },
  inviteButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Sizes.tapTarget,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryFill,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  faces: {
    flexDirection: 'row',
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  overlap: {
    marginLeft: -10,
  },
  quiet: {
    paddingHorizontal: Spacing.xs,
  },
}));
