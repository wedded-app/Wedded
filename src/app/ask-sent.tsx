import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Spacing, Springs, useColors } from '@/constants/theme';
import { useConversations } from '@/data/chat';
import { useHomeEvents } from '@/data/reference';
import { PushAskCard } from '@/features/chat/push-ask';
import { useSession } from '@/features/auth/session';
import { useInquiryVendor } from '@/features/inquiry/inquiry-helpers';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * "Sent" (vision S12): what happens next, and the honest faster route (call or
 * text now), because that's how this community books. `?queued=1` when the
 * app's daily email limit was reached and it goes out tomorrow.
 */
export default function AskSentScreen() {
  const Colors = useColors();
  const { t } = useLocale();
  // Phone sign-ins have no email, so no copy goes anywhere
  const { email } = useSession();
  const params = useLocalSearchParams<{ vendorId?: string; event?: string; queued?: string }>();
  const vendor = useInquiryVendor(params.vendorId ?? '');
  // The inquiry started (or continued) a chat with this vendor
  const conversation = useConversations().data?.find(
    (c) => c.side === 'family' && c.vendor.id === params.vendorId,
  );
  const events = useHomeEvents();

  const name = vendor.data ? localized(vendor.data.name) : '';
  const event = events.data
    ?.flatMap((section) => section.events)
    .find((candidate) => candidate.slug === params.event);
  const callNumber = vendor.data?.callPhone ?? vendor.data?.whatsappPhone ?? null;
  const textNumber = vendor.data?.textPhone ?? vendor.data?.callPhone ?? null;

  // The check springs in once, with the success tap you feel (vision §4).
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0.4);
  useEffect(() => {
    successHaptic();
    grow.value = withSpring(1, Springs.pop);
  }, [grow]);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.check, checkStyle]}>
          <Icon name="checkmark-circle" size={80} color={Colors.success} />
        </Animated.View>
        <AppText variant="title" accessibilityRole="header" style={styles.center}>
          {params.queued
            ? t('inquiry.sent.queuedTitle', { vendor: name })
            : t('inquiry.sent.title', { vendor: name })}
        </AppText>
        <AppText variant="bodyLg" color="text2" style={styles.center}>
          {t(email ? 'inquiry.sent.next' : 'inquiry.sent.nextNoEmail')}
        </AppText>

        {conversation && (
          <Card style={styles.card}>
            <AppText variant="heading">{t('inquiry.sent.chatTitle')}</AppText>
            <AppText color="text2">{t('inquiry.sent.chatBody', { vendor: name })}</AppText>
            <Button
              icon="chatbubbles-outline"
              label={t('inquiry.sent.chatButton')}
              onPress={() => {
                router.back();
                router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
              }}
            />
          </Card>
        )}

        {(callNumber || textNumber) && (
          <Card style={styles.card}>
            <AppText variant="heading">{t('inquiry.sent.faster')}</AppText>
            {callNumber && (
              <Button
                variant="secondary"
                icon="call-outline"
                label={t('inquiry.sent.callNow')}
                onPress={() => Linking.openURL(`tel:${callNumber}`)}
              />
            )}
            {textNumber && (
              <Button
                variant="secondary"
                icon="chatbubble-outline"
                label={t('inquiry.sent.textNow')}
                onPress={() => Linking.openURL(`sms:${textNumber}`)}
              />
            )}
          </Card>
        )}

        <Card style={styles.card}>
          <AppText>
            {event
              ? t('inquiry.sent.savedTo', { event: localized(event.name) })
              : t('inquiry.sent.savedNotSure')}
          </AppText>
          <Button
            variant="text"
            label={t('inquiry.sent.viewSaved')}
            onPress={() => router.replace('/saved')}
          />
        </Card>

        {/* The vendor's reply comes in the app: offer a buzz when it does */}
        <PushAskCard audience="family" />

        <Button
          variant="text"
          label={t('inquiry.sent.seeRequests')}
          onPress={() => router.replace('/my-inquiries')}
        />
        <Button label={t('location.done')} onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  check: {
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.md,
  },
});
