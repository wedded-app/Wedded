import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SampleTag } from '@/components/sample-tag';
import { Icon, type IconName } from '@/components/icon';
import { backgroundCss, makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { initials } from './requests-format';

/** A family's letters on a soft maroon-to-rose circle: no photo, ever. */
export function FamilyAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const Colors = useColors();
  const image = `linear-gradient(135deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;
  return (
    <View
      accessible={false}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.heroFrom,
        },
        backgroundCss(image),
      ]}
    >
      <AppText
        weight={700}
        color="onHero"
        style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </AppText>
    </View>
  );
}

/** One fact under a post's headline: an icon and a few words. */
function Fact({ icon, children }: { icon: IconName; children: string }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={Colors.text2} />
      <AppText variant="label" weight={500} color="text2">
        {children}
      </AppText>
    </View>
  );
}

export type PostFacts = {
  date?: string | null;
  guests?: string | null;
  budget?: string | null;
  distance?: string | null;
};

/**
 * A family's request as a post, the way Threads lays one out: their letters,
 * "Harjit K. · Yuba City · 2h", the headline ("DJ for the Reception"), the
 * facts (date, guests, budget, distance), their note, then `footer` (what the
 * vendor can do). Only the short name and the town, never contact details.
 */
export function LookingPost({
  familyName,
  city,
  ago,
  headline,
  facts,
  note,
  footer,
  isSample = false,
}: {
  familyName: string;
  city: string;
  ago?: string | null;
  headline: string;
  facts: PostFacts;
  note?: string | null;
  footer?: ReactNode;
  /** A demo sample family: shows the Sample tag. */
  isSample?: boolean;
}) {
  const styles = useStyles();
  const byline = [city, ago].filter(Boolean).join(' · ');
  return (
    <View style={styles.post}>
      <FamilyAvatar name={familyName} />
      <View style={styles.body}>
        <View style={styles.byline}>
          <AppText weight={700}>{familyName}</AppText>
          {byline ? (
            <AppText color="text2" style={styles.shrink} numberOfLines={1}>
              {`· ${byline}`}
            </AppText>
          ) : null}
        </View>
        <SampleTag show={isSample} />
        <AppText variant="bodyLg" weight={600}>
          {headline}
        </AppText>
        <View style={styles.facts}>
          {facts.date && <Fact icon="calendar-outline">{facts.date}</Fact>}
          {facts.guests && <Fact icon="people-outline">{facts.guests}</Fact>}
          {facts.budget && <Fact icon="cash-outline">{facts.budget}</Fact>}
          {facts.distance && <Fact icon="location-outline">{facts.distance}</Fact>}
        </View>
        {note ? <AppText>{note}</AppText> : null}
        {footer}
      </View>
    </View>
  );
}

/** The gold "Wedded Pro" mark. */
export function ProBadge() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View style={styles.pro}>
      <Icon name="sparkles" size={14} color={Colors.kesari} />
      <AppText variant="caption" weight={700} color="kesari">
        {t('pro.badge')}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  post: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  body: {
    flex: 1,
    gap: Spacing.sm,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
    rowGap: Spacing.xs,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.chip,
    backgroundColor: Colors.kesariTint,
  },
}));
