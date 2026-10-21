import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/chip';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { useAllEventNeeds, useHomeEvents } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

import { bookFirstNeeds } from './book-first';
import { SectionHeader } from './section-header';
import { VendorPhotoCards } from './vendor-photo-cards';
import { useWeddingDraft } from './wedding-draft';

const SHOWN = 5;

/**
 * Book these first, on Home before there's a plan: the kinds of vendor to
 * start with (the venue, then what the main events need most; bookFirstNeeds)
 * as a row of chips, and under the chosen one the vendors of that kind as big
 * photo cards. They sharpen as the wedding card's questions are answered:
 * near where it is, halls that seat everyone, and with a date, only those
 * not booked that day, each card saying so.
 */
export function BookFirst() {
  const styles = useStyles();
  const { t } = useLocale();
  const sections = useHomeEvents();
  const needs = useAllEventNeeds();
  const { date, guestBand } = useWeddingDraft();
  const items = sections.data && needs.data ? bookFirstNeeds(sections.data, needs.data, SHOWN) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const need = items.find((item) => item.categorySlug === picked) ?? items[0];

  if (!need) return null;

  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.bookFirst.title')}
        link={t('home.seeAllTypes')}
        onLink={() => router.navigate('/search')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {items.map((item) => (
          <Chip
            key={item.categorySlug}
            label={localized(item.name)}
            role="radio"
            tone="ink"
            selected={item.categorySlug === need.categorySlug}
            onPress={() => setPicked(item.categorySlug)}
          />
        ))}
      </ScrollView>
      <VendorPhotoCards
        key={need.categorySlug}
        categorySlug={need.categorySlug}
        groupSlug={need.groupSlug}
        date={date}
        guestBand={guestBand}
        emptyText={t('home.noneYet')}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  block: {
    gap: Spacing.md,
  },
  // The chips run to the screen edges while the first one lines up with the page
  bleed: {
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
}));
