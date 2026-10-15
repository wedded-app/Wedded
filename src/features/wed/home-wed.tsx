import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { ListRow, ListSection } from '@/components/list';
import { makeStyles, Sizes, Spacing } from '@/constants/theme';
import { SectionHeader } from '@/features/home/section-header';
import { Motion } from '@/lib/motion';

import { ApprovalCard } from './approval-card';
import { FAMILY } from './mock';
import { openWed } from './open-wed';
import { activeTasks, receiptText, type WedState, useWed } from './wed-store';
import { WedMark } from './wed-mark';

// Home keeps it short: two cards at most, the rest are one tap away
const SHOWN = 2;

// Cards waiting for a yes, plus any said yes to in the last 10 seconds so
// their Undo stays where it was. Newest first. Selectors live out here so
// useWed sees the same function every render.
const cardIds = (s: WedState) =>
  s.approvals
    .filter((a) => a.stage === 'waiting' || a.stage === 'held')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((a) => a.id);
const workingCount = (s: WedState) => activeTasks(s).length;
const statusLine = (s: WedState) => s.status;
// The last card said yes to, once its Undo is over: Home keeps saying it went
const lastDone = (s: WedState) => {
  const done = s.approvals
    .filter((a) => a.stage === 'done' && !(a.preview && a.chose === 'verb'))
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))[0];
  return done ? receiptText(done) : null;
};

/**
 * MOCKUP: Wed on Home, under the search box, and never more than a glance.
 * With cards waiting for a yes: "Needs your OK" and up to two short cards
 * (the message and what it shares come before the button; Look first opens
 * the card in Wed), then "See all 3 in Wed" when there are more. While Wed
 * works or waits on someone: one row saying so, with the status line under
 * it (still, no shimmer). With nothing either way: one quiet row that opens
 * the chat. Approving here resolves the card in the thread and on Updates.
 */
export function WedHomeSection() {
  const styles = useStyles();
  const ids = useWed(cardIds);
  const working = useWed(workingCount);
  const status = useWed(statusLine);
  const done = useWed(lastDone);
  const role = useWed((s) => s.role);
  const cards = ids.slice(0, SHOWN);
  const more = ids.length > cards.length;
  // Says who's asking, since the short cards have no "Needs your OK" of their own
  const title =
    role === 'owner'
      ? 'Wed needs your OK'
      : role === 'suggester'
        ? `Ideas for ${FAMILY.owner}`
        : `Waiting for ${FAMILY.owner}'s OK`;

  return (
    // Cards already there when Home opens just sit there; new ones rise in
    <LayoutAnimationConfig skipEntering>
      <View style={styles.block}>
        {cards.length > 0 && <SectionHeader title={title} />}
        {cards.map((id) => (
          <Animated.View
            key={id}
            entering={Motion.rise}
            exiting={Motion.exit}
            layout={Motion.layout}
          >
            <ApprovalCard id={id} variant="compact" on="grouped" />
          </Animated.View>
        ))}

        {(more || working > 0 || done) && (
          <Animated.View entering={Motion.enter} layout={Motion.layout}>
            <ListSection inset>
              {done && (
                <ListRow
                  key="done"
                  icon="checkmark-circle"
                  iconColor="success"
                  title={done}
                  subtitle="See it in Wed"
                  chevron
                  onPress={() => router.navigate('/wed/updates')}
                />
              )}
              {more && (
                <ListRow
                  key="all"
                  icon="notifications-outline"
                  iconColor="text"
                  title={`See all ${ids.length} in Wed`}
                  onPress={() => router.navigate('/wed/updates')}
                />
              )}
              {working > 0 && (
                <ListRow
                  key="working"
                  leading={<Mark />}
                  title={`Wed is working on ${working} ${working === 1 ? 'thing' : 'things'}`}
                  subtitle={status}
                  accessibilityLabel={`Wed is working on ${working} ${working === 1 ? 'thing' : 'things'}. ${status}`}
                  onPress={() => router.navigate('/wed/updates')}
                />
              )}
            </ListSection>
          </Animated.View>
        )}

        {cards.length === 0 && working === 0 && !done && (
          <Animated.View entering={Motion.enter}>
            <ListSection inset>
              <ListRow
                leading={<Mark />}
                title="Ask Wed to find something"
                onPress={() => openWed()}
              />
            </ListSection>
          </Animated.View>
        )}
      </View>
    </LayoutAnimationConfig>
  );
}

/** The ribbon in a row's icon slot, so its text lines up with the other rows. */
function Mark() {
  const styles = useStyles();
  return (
    <View style={styles.mark}>
      <WedMark size={20} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  block: {
    gap: Spacing.md,
  },
  mark: {
    width: Sizes.rowIcon,
    alignItems: 'center',
  },
}));
