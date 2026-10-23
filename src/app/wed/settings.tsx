import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection, SectionTitle } from '@/components/list';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { makeStyles, Spacing } from '@/constants/theme';
import { FAMILY } from '@/features/wed/mock';
import { ModeSwitch } from '@/features/wed/mode-switch';
import { WedCloseButton } from '@/features/wed/close-wed';
import { WED_BACK } from '@/features/wed/open-wed';
import { useWed, wed, type CheckIns, type Role } from '@/features/wed/wed-store';
import { selectionHaptic } from '@/lib/haptics';

// The same in both modes; there is no "do everything" choice
const ALWAYS_NEEDS_A_TAP = [
  'Messaging a vendor',
  'Booking, or marking something booked',
  'Paying',
  'Sharing your phone number',
  'Inviting or removing family',
  'Reminding family',
  'Posting reels',
  'Deleting anything',
];

const CHECK_INS: { value: CheckIns; label: string; words: string }[] = [
  // Short enough for one line in each segment; the line under says the rest
  { value: 'needed', label: 'When needed', words: 'Only when something needs your OK.' },
  {
    value: 'daily',
    label: 'Daily',
    words: 'When something needs your OK, and a short catch-up each evening.',
  },
  { value: 'often', label: 'Often', words: 'Every vendor reply, and ideas as Wed finds them.' },
];

const ROLES: { value: Role; label: string; words: string }[] = [
  {
    value: 'owner',
    label: 'Owner',
    words: `You see the cards as ${FAMILY.owner}, who can say yes.`,
  },
  {
    value: 'suggester',
    label: 'Can suggest',
    words: `Cards offer "Suggest to ${FAMILY.owner}" instead of yes.`,
  },
  {
    value: 'viewer',
    label: 'Viewer',
    words: `Cards wait for ${FAMILY.owner}'s OK, with a Remind button.`,
  },
];

/**
 * MOCKUP: How much Wed does. Ask me first (the default) or Do the small
 * things, then the list of what always needs a tap in either mode, how often
 * Wed speaks up, links to what Wed knows and the apps it uses, and, for the
 * demo only, who to preview the cards as and Replay. Changing the mode makes
 * Wed say what changes in the chat.
 */
export default function WedSettingsScreen() {
  const styles = useStyles();
  const mode = useWed((s) => s.mode);
  const checkIns = useWed((s) => s.checkIns);
  const role = useWed((s) => s.role);
  const [replayed, setReplayed] = useState(false);

  return (
    <NavScreen
      title="How much Wed does"
      navTitle="Settings"
      backTo={WED_BACK}
      trailing={<WedCloseButton />}
    >
      <ModeSwitch value={mode} onChange={wed.setMode} />

      <View style={styles.block}>
        <ListSection inset header="Always needs your tap">
          {ALWAYS_NEEDS_A_TAP.map((action) => (
            // A lock, not a tick: these are fixed rules, not boxes to untick
            <ListRow
              key={action}
              icon="lock-closed-outline"
              iconColor="text2"
              title={action}
              accessibilityLabel={`${action} always needs your tap`}
            />
          ))}
        </ListSection>
        <AppText variant="label" weight={400} color="text2" style={styles.footnote}>
          These can&apos;t be turned off. Only people who can edit your plan can say yes. Wed asks
          at most 5 vendors an hour and 15 a day, and never sends spam.
        </AppText>
      </View>

      <View style={styles.block}>
        <SectionTitle>When should Wed tell you things?</SectionTitle>
        <Segmented<CheckIns>
          accessibilityLabel="When should Wed tell you things?"
          value={checkIns}
          onChange={wed.setCheckIns}
          options={CHECK_INS.map(({ value, label }) => ({ value, label }))}
        />
        <AppText color="text2" style={styles.inset}>
          {CHECK_INS.find((option) => option.value === checkIns)?.words}
        </AppText>
      </View>

      <ListSection inset>
        <ListRow
          icon="book-outline"
          iconColor="text"
          title="What Wed knows"
          onPress={() => router.push('/wed/memory')}
        />
        <ListRow
          icon="apps-outline"
          iconColor="text"
          title="Apps Wed can use"
          onPress={() => router.push('/wed/apps')}
        />
      </ListSection>

      <ListSection header="Demo (mockup only)">
        <View style={styles.preview}>
          <AppText weight={500}>Preview as</AppText>
          <Segmented<Role>
            accessibilityLabel="Preview the cards as"
            value={role}
            onChange={wed.setRole}
            options={ROLES.map(({ value, label }) => ({ value, label }))}
          />
          <AppText variant="label" weight={400} color="text2">
            {ROLES.find((option) => option.value === role)?.words}
          </AppText>
        </View>
        <ListRow
          icon="refresh-outline"
          iconColor="text"
          title="Replay the demo"
          subtitle={replayed ? 'Started over' : 'Starts the chat and the cards over'}
          chevron={false}
          onPress={() => {
            selectionHaptic();
            wed.reset();
            setReplayed(true);
          }}
        />
      </ListSection>
    </NavScreen>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  footnote: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
  },
  inset: {
    paddingHorizontal: Spacing.xs,
  },
  preview: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
}));
