import { router, type Href } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { StateView } from '@/components/state-view';
import { VendorCard } from '@/components/vendor-card';
import { Spacing, useColors } from '@/constants/theme';
import { useHomeEvents } from '@/data/reference';
import { useSavedVendors, useSaveVendor, type SavedVendor } from '@/data/saved';
import { useSession } from '@/features/auth/session';
import { localized, type LocalizedText } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

type Section = { key: string; title: LocalizedText; data: SavedVendor[] };

/**
 * Saved (vision S15): everything the family saved, grouped by event in
 * ceremony order, then "Not sure yet". Saving needs an account; logged out,
 * this tab explains that and offers sign-in.
 */
export default function SavedScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  const { status, requireSignIn } = useSession();
  const saved = useSavedVendors();
  const events = useHomeEvents();
  const { removeSave } = useSaveVendor();

  let body;
  if (status === 'signedOut' || status === 'needsProfile') {
    body = (
      <StateView
        state="empty"
        icon="heart-outline"
        message={t('saved.signInToSee')}
        action={{ label: t('profile.account.signIn'), onPress: () => requireSignIn() }}
      />
    );
  } else if (status === 'loading' || saved.isPending || events.isPending) {
    body = <StateView state="loading" />;
  } else if (status === 'error' || saved.isError || events.isError) {
    body = (
      <StateView
        state="error"
        onRetry={() => {
          void saved.refetch();
          void events.refetch();
        }}
      />
    );
  } else if (saved.data.length === 0) {
    body = <StateView state="empty" icon="heart-outline" message={t('saved.empty')} />;
  } else {
    const sections = groupByEvent(
      saved.data,
      events.data.flatMap((section) => section.events),
      t('saved.notSure'),
    );
    body = sections.map((section) => (
      <View key={section.key} style={styles.section}>
        <SectionTitle>{localized(section.title)}</SectionTitle>
        <CompareButton
          slugs={section.data.flatMap((save) => (save.vendor ? [save.vendor.slug] : []))}
        />
        {section.data.map((save) => (
          <SavedItem key={save.id} save={save} onRemove={() => removeSave(save.id)} />
        ))}
      </View>
    ));
  }

  const signedIn = status === 'signedIn';
  return (
    <NavScreen
      title={t('tabs.saved')}
      back={false}
      eyebrow={
        signedIn && saved.data && saved.data.length > 0
          ? t('saved.count', { count: saved.data.length })
          : null
      }
      refreshControl={
        signedIn ? (
          <RefreshControl
            refreshing={saved.isRefetching}
            onRefresh={() => void saved.refetch()}
            tintColor={Colors.chevron}
            colors={[Colors.primary]}
          />
        ) : undefined
      }
    >
      {body}
    </NavScreen>
  );
}

function SavedItem({ save, onRemove }: { save: SavedVendor; onRemove: () => void }) {
  const { t } = useLocale();
  const { vendor } = save;

  return (
    <View style={styles.item}>
      {vendor ? (
        <VendorCard
          name={vendor.name}
          category={vendor.category ?? { en: '' }}
          city={vendor.city}
          startingPrice={vendor.startingPrice}
          photoUrl={vendor.photoUrl}
          // The vendor profile route (/v/{slug}, vision S9) is being built
          // alongside this; until it lands this opens the not-found screen.
          onPress={() => router.push(`/v/${vendor.slug}` as Href)}
        />
      ) : (
        <Card>
          <AppText color="text2">{t('saved.noLongerListed')}</AppText>
        </Card>
      )}
      <Button
        variant="text"
        icon="heart-dislike-outline"
        label={t('saved.remove')}
        accessibilityLabel={
          vendor ? t('saved.removeNamed', { name: localized(vendor.name) }) : t('saved.remove')
        }
        onPress={onRemove}
        style={styles.remove}
      />
    </View>
  );
}

/** Saves grouped by event in ceremony order, then "Not sure yet" last. */
function groupByEvent(
  saves: SavedVendor[],
  orderedEvents: { slug: string; name: LocalizedText }[],
  notSureLabel: string,
): Section[] {
  const sections: Section[] = [];
  for (const event of orderedEvents) {
    const data = saves.filter((save) => save.eventSlug === event.slug);
    if (data.length > 0) sections.push({ key: event.slug, title: event.name, data });
  }
  // Saves for events outside the default culture's list, just in case.
  const known = new Set(orderedEvents.map((event) => event.slug));
  for (const save of saves) {
    if (save.eventSlug && !known.has(save.eventSlug)) {
      let section = sections.find((s) => s.key === save.eventSlug);
      if (!section) {
        section = { key: save.eventSlug, title: { en: save.eventSlug }, data: [] };
        sections.push(section);
      }
      section.data.push(save);
    }
  }
  const notSure = saves.filter((save) => save.eventSlug === null);
  if (notSure.length > 0) {
    sections.push({ key: 'not-sure', title: { en: notSureLabel }, data: notSure });
  }
  return sections;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.lg,
  },
  item: {
    gap: Spacing.xs,
  },
  remove: {
    alignSelf: 'center',
    minHeight: 44,
  },
});

/** "Compare" for an event group with two or more listed vendors. */
function CompareButton({ slugs }: { slugs: string[] }) {
  const { t } = useLocale();
  if (slugs.length < 2) return null;
  return (
    <Button
      variant="text"
      icon="git-compare-outline"
      label={t('compare.button', { count: Math.min(slugs.length, 3) })}
      onPress={() => router.push({ pathname: '/compare', params: { vendors: slugs.join(',') } })}
    />
  );
}
