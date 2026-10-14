// TEMPORARY preview of the new effects for Kirat; not committed.
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { HoloShine } from '@/components/holo-shine';
import { Icon } from '@/components/icon';
import { PetalBurst } from '@/components/petal-burst';
import { Screen } from '@/components/screen';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { CountdownCard } from '@/features/planner/countdown-card';
import { EMPTY_PLAN } from '@/features/planner/plan';

export default function EffectsDemo() {
  const Colors = useColors();
  const [burst, setBurst] = useState(0);
  // Replays the petals every 4 seconds so they're easy to see
  useEffect(() => {
    const first = setTimeout(() => setBurst((n) => n + 1), 800);
    const timer = setInterval(() => setBurst((n) => n + 1), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.xl }}>
        <AppText variant="title">New effects</AppText>

        <AppText variant="heading">1. Liquid light on the countdown</AppText>
        <CountdownCard
          plan={{ ...EMPTY_PLAN, weddingDate: '2027-06-12' }}
          progress={{ done: 7, total: 18 }}
          eventsCount={5}
        />

        <AppText variant="heading">2. Holographic Founding badge</AppText>
        <HoloShine
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: Spacing.xs,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs + 2,
            borderRadius: Radius.chip,
            backgroundColor: Colors.kesariTint,
          }}
        >
          <Icon name="ribbon-outline" size={17} color={Colors.kesari} weight="semibold" />
          <AppText variant="label" weight={600} color="kesari">
            Founding vendor #3
          </AppText>
        </HoloShine>

        <AppText variant="heading">3. Petals for big moments</AppText>
        <View style={{ gap: Spacing.sm }}>
          <AppText color="text2">
            Plays when an event is all booked, a request is sent, and the plan is ready.
          </AppText>
          <Button label="Play the petals" icon="sparkles" onPress={() => setBurst((n) => n + 1)} />
        </View>
      </ScrollView>
      <PetalBurst play={burst} />
    </Screen>
  );
}
