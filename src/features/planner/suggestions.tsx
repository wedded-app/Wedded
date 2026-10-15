import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useCategories, type TraditionEvent } from '@/data/reference';
import { useWeddingMembers, type AccountWedding } from '@/data/wedding';
import {
  useResolveSuggestion,
  useWeddingSuggestions,
  useWithdrawSuggestion,
  type WeddingSuggestion,
} from '@/data/wedding-suggestions';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * Suggestions on My Wedding, like suggesting in Google Docs: a vendor someone
 * suggested for an event, who suggested it and why. The owner and editors
 * accept (the vendor is booked in the plan) or decline; whoever suggested it
 * can take it back while it waits. Decided ones stay for two weeks so people
 * see what happened. Suggesters with nothing waiting see how to suggest.
 */
export function Suggestions({
  wedding,
  events,
}: {
  wedding: AccountWedding;
  /** The plan's events, for their names in the family's tradition. */
  events: TraditionEvent[];
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const suggestions = useWeddingSuggestions(wedding.id);
  const members = useWeddingMembers(wedding.id);
  const categories = useCategories();
  const resolve = useResolveSuggestion(wedding.id);
  const withdraw = useWithdrawSuggestion(wedding.id);
  const [error, setError] = useState<string>();

  const canDecide = wedding.role !== 'suggester';
  const list = suggestions.data ?? [];
  if (list.length === 0 && canDecide) return null;

  const me = members.data?.find((m) => m.isMe)?.userId;
  const nameOf = (userId: string | null) =>
    members.data?.find((m) => m.userId === userId)?.name?.split(' ')[0] ??
    t('planTogether.someone');
  const eventName = (slug: string) => {
    const event = events.find((e) => e.slug === slug);
    return event ? localized(event.name) : slug;
  };
  const categoryName = (slug: string) => {
    const category = categories.data?.find((c) => c.slug === slug);
    return category ? localized(category.name) : slug;
  };
  const failed = () => setError(t('suggestions.failed'));

  const decide = (s: WeddingSuggestion, accept: boolean) => {
    setError(undefined);
    resolve.mutate(
      { id: s.id, accept },
      {
        onSuccess: () => (accept ? successHaptic() : selectionHaptic()),
        onError: failed,
      },
    );
  };

  const open = list.filter((s) => s.status === 'open').length;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Icon name="bulb-outline" size={28} color={Colors.primary} />
        <AppText variant="heading" weight={700} style={styles.grow}>
          {t('suggestions.title')}
        </AppText>
        {open > 0 && (
          <View style={styles.count}>
            <AppText variant="label" weight={700} color="onPrimary">
              {open}
            </AppText>
          </View>
        )}
      </View>
      {!canDecide && <AppText color="text2">{t('suggestions.howTo')}</AppText>}

      {list.map((s) => {
        const mine = s.suggestedBy === me;
        const busy =
          (resolve.isPending && resolve.variables?.id === s.id) ||
          (withdraw.isPending && withdraw.variables === s.id);
        const vendorName = s.vendor ? localized(s.vendor.name) : '…';
        return (
          <Animated.View
            key={s.id}
            layout={Motion.layout}
            entering={Motion.enter}
            exiting={Motion.exit}
            style={[styles.item, s.status !== 'open' && styles.itemDone]}
          >
            <Pressable
              accessibilityRole="link"
              disabled={!s.vendor}
              onPress={() =>
                s.vendor &&
                router.push({
                  pathname: '/v/[slug]',
                  params: { slug: s.vendor.slug, event: s.eventSlug },
                })
              }
              style={({ pressed }) => [styles.vendor, pressed && styles.pressed]}
            >
              <View style={styles.grow}>
                <AppText variant="bodyLg" weight={600}>
                  {vendorName}
                </AppText>
                <AppText variant="label" weight={400} color="text2">
                  {t('suggestions.for', {
                    event: eventName(s.eventSlug),
                    category: categoryName(s.categorySlug),
                  })}
                </AppText>
              </View>
              {s.vendor && <Icon name="chevron-forward" size={16} color={Colors.chevron} />}
            </Pressable>

            {s.note && (
              <AppText color="text2" style={styles.note}>
                “{s.note}”
              </AppText>
            )}
            <AppText variant="caption" color="text2">
              {mine ? t('suggestions.byYou') : t('suggestions.by', { name: nameOf(s.suggestedBy) })}
            </AppText>

            {s.status === 'open' && canDecide && (
              <View style={styles.actions}>
                <Button
                  icon="checkmark"
                  label={t('suggestions.accept')}
                  loading={busy && resolve.variables?.accept === true}
                  disabled={busy}
                  onPress={() => decide(s, true)}
                  style={styles.grow}
                />
                <Button
                  variant="secondary"
                  label={t('suggestions.decline')}
                  loading={busy && resolve.variables?.accept === false}
                  disabled={busy}
                  onPress={() => decide(s, false)}
                  style={styles.grow}
                />
              </View>
            )}
            {s.status === 'open' && !canDecide && (
              <View style={styles.waiting}>
                <AppText variant="label" weight={600} color="kesari" style={styles.grow}>
                  {t('suggestions.waiting')}
                </AppText>
                {mine && (
                  <Button
                    variant="text"
                    label={t('suggestions.withdraw')}
                    loading={busy}
                    onPress={() => {
                      setError(undefined);
                      withdraw.mutate(s.id, { onError: failed });
                    }}
                  />
                )}
              </View>
            )}
            {s.status !== 'open' && (
              <View style={styles.waiting}>
                <Icon
                  name={s.status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={s.status === 'accepted' ? Colors.success : Colors.text2}
                />
                <AppText
                  variant="label"
                  weight={600}
                  color={s.status === 'accepted' ? 'success' : 'text2'}
                >
                  {s.status === 'accepted' ? t('suggestions.accepted') : t('suggestions.declined')}
                </AppText>
              </View>
            )}
          </Animated.View>
        );
      })}
      {error && <FieldError message={error} />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
  },
  count: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  item: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
  },
  itemDone: {
    opacity: 0.8,
  },
  vendor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.6,
  },
  note: {
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
  },
}));
