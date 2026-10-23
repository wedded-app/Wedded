import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { enablePush, pushStatus } from '@/data/push';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const statusKey = ['push-status'] as const;

/** Whether message alerts are on, not asked yet, refused, or impossible on this phone. */
export function usePushStatus() {
  return useQuery({ queryKey: statusKey, queryFn: pushStatus, staleTime: 30 * 1000 });
}

/**
 * Turn message alerts on: the system question (asked once, only from a
 * button that has said why), then this phone is registered. Refreshes the
 * status everywhere it's shown.
 */
export function useEnablePush() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Awaited<ReturnType<typeof enablePush>> | null>(null);
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    const outcome = await enablePush();
    setBusy(false);
    setResult(outcome);
    if (outcome === 'enabled') successHaptic();
    void queryClient.invalidateQueries({ queryKey: statusKey });
  };
  return { enable: () => void enable(), result, busy };
}

// "Not now" hides the card for the rest of the session, everywhere
let notNow = false;
const listeners = new Set<() => void>();
function dismiss() {
  notNow = true;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * "Get a buzz when vendors reply": says why before the phone asks, at the
 * moments it matters (after a request is sent, in a chat, a vendor's
 * inbox). Hidden once alerts are on, where they can't work (the web, Expo
 * Go on Android), after "Not now", and for people who already said no, so
 * nobody is nagged. Saying no here offers Settings instead.
 */
export function PushAskCard({ audience }: { audience: 'family' | 'vendor' }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const status = usePushStatus();
  const { enable, result, busy } = useEnablePush();
  const dismissed = useSyncExternalStore(
    subscribe,
    () => notNow,
    () => notNow,
  );

  // Just turned on: a thank-you in its place
  if (result === 'enabled') {
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.top}>
          <Icon name="checkmark-circle" size={24} color={Colors.success} />
          <AppText weight={600} style={styles.grow}>
            {t('chat.alerts.on')}
          </AppText>
        </View>
      </View>
    );
  }
  // Just said no to the phone's question: how to change their mind
  if (result === 'denied') {
    return (
      <View style={styles.card}>
        <AppText>{t('chat.alerts.deniedBody')}</AppText>
        <Button
          variant="secondary"
          label={t('chat.alerts.openSettings')}
          onPress={() => void Linking.openSettings()}
        />
      </View>
    );
  }
  if (dismissed || status.data !== 'undetermined') return null;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.bell}>
          <Icon name="notifications" size={22} color={Colors.onPrimary} />
        </View>
        <View style={styles.grow}>
          <AppText variant="bodyLg" weight={700}>
            {t(`chat.alerts.title.${audience}`)}
          </AppText>
          <AppText color="text2">{t(`chat.alerts.body.${audience}`)}</AppText>
        </View>
      </View>
      {result === 'failed' && <AppText color="error">{t('chat.alerts.failed')}</AppText>}
      <Button
        icon="notifications-outline"
        label={t('chat.alerts.turnOn')}
        loading={busy}
        onPress={enable}
      />
      <Button variant="text" label={t('chat.alerts.notNow')} onPress={dismiss} />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFill,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
}));
