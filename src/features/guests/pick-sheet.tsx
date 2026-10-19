import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, FlatList, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Checkbox } from '@/components/checkbox';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { SheetHeader } from '@/components/sheet-header';
import { makeStyles, Radius, Sizes, Spacing } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { matchesSearch } from './guest-helpers';

export type PickItem = {
  id: string;
  name: string;
  /** A second line: a phone number, or their answer so far. */
  detail?: string;
  /** Ticked, and can't be unticked here (already on the list, already invited). */
  locked?: boolean;
};

export type PickSheetProps = {
  title: string;
  intro?: string;
  /** More above the list, e.g. the list's name or "Tick a whole list". */
  children?: ReactNode;
  items: PickItem[];
  picked: string[];
  onChange: (picked: string[]) => void;
  /** Said instead of the list when there's no one to tick. */
  empty?: ReactNode;
  /** The button at the bottom, and any error. */
  footer: ReactNode;
};

/** Leave a sheet: back where it was opened, or the guest list after a link. */
export function closeGuestSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/guests');
}

/** Asks first on phones (an alert) and on the web (the browser's confirm). */
export function confirm(title: string, body: string, yes: string, no: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(body)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

/**
 * A sheet for ticking people (contacts to add, who's on a list, who's
 * invited to an event): a search box over a long list of round ticks, and
 * one button at the bottom. Scrolls smoothly through a thousand contacts.
 */
export function PickSheet({
  title,
  intro,
  children,
  items,
  picked,
  onChange,
  empty,
  footer,
}: PickSheetProps) {
  const styles = useStyles();
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const shown = items.filter((item) => matchesSearch(query, item.name, item.detail));
  const ticked = new Set(picked);
  const toggle = (id: string) =>
    onChange(ticked.has(id) ? picked.filter((p) => p !== id) : [...picked, id]);

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={closeGuestSheet} />
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.intro}>
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
              {intro ? <AppText color="text2">{intro}</AppText> : null}
            </View>
            {children}
            {items.length > 0 && (
              <SearchField value={query} onChangeText={setQuery} placeholder={t('guests.search')} />
            )}
          </View>
        }
        ListEmptyComponent={
          items.length > 0 ? (
            <AppText color="text2" style={styles.intro}>
              {t('guests.noMatch', { query: query.trim() })}
            </AppText>
          ) : (
            <>{empty}</>
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item, index }) => (
          <Checkbox
            label={item.name}
            detail={item.detail}
            checked={item.locked || ticked.has(item.id)}
            disabled={item.locked}
            onChange={() => toggle(item.id)}
            style={[
              styles.row,
              index === 0 && styles.first,
              index === shown.length - 1 && styles.last,
            ]}
          />
        )}
      />
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

/** A hairline between rows that starts where the text does, on the rows' white. */
function Separator() {
  const styles = useStyles();
  return (
    <View style={styles.separatorRow}>
      <View style={styles.separator} />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  header: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  intro: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  row: {
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  first: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  last: {
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
  },
  separatorRow: {
    backgroundColor: Colors.surface,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg + Sizes.checkbox + Spacing.md,
    backgroundColor: Colors.separator,
  },
  footer: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
}));
