import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale, useTypeStyle } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { Motion } from '@/lib/motion';

import { GuestDetails } from './guest-details';
import { useGuestList } from './guest-list';
import { FAMILY } from './mock';
import { openWed } from './open-wed';
import { receiptText, SENDS, useWed, wed, type Approval, type Role } from './wed-store';
import { WedMark } from './wed-mark';

export type ApprovalCardProps = {
  /** The approval's id in the store. */
  id: string;
  /** full: the whole card (the thread, Updates). compact: Home's short card. */
  variant?: 'full' | 'compact';
  /** canvas: on the white thread (grey card). grouped: on a grey page (white card). */
  on?: 'canvas' | 'grouped';
};

/**
 * Wed never messages, books or pays on its own: anything that reaches a
 * vendor waits on one of these. The full card says who it goes to, what it's
 * for, what it shares, what it costs and how to undo it, shows the exact
 * message (which the family can change), and names the action on its
 * button ("Ask all 3"). Saying yes holds it for 10 seconds with Undo and a
 * countdown, then it becomes a receipt ("Asked 3 dhol players · 9:41 PM").
 * It reads the approval from the store, so a yes on Home resolves it in the
 * thread and on Updates too. Someone who can only suggest gets "Suggest to
 * Simran"; a viewer gets "Remind Simran" instead of buttons, and neither is
 * told it needs their OK. Maroon is only on the yes; the other choices are
 * grey or plain.
 */
export function ApprovalCard({ id, variant = 'full', on = 'canvas' }: ApprovalCardProps) {
  const styles = useStyles();
  const approval = useWed((s) => s.approvals.find((a) => a.id === id));
  const role = useWed((s) => s.role);
  if (!approval) return null;

  const filled = variant === 'compact' || on === 'grouped' ? styles.onGrouped : styles.onCanvas;
  const settled = approval.stage === 'done' || approval.stage === 'declined';

  return (
    <Animated.View
      layout={Motion.layout}
      style={[
        styles.card,
        approval.stage === 'waiting' ? styles.open : styles.closed,
        settled && on === 'canvas' && variant === 'full' ? styles.bare : filled,
      ]}
    >
      <Animated.View key={approval.stage} entering={Motion.enter} style={styles.stage}>
        {approval.stage === 'waiting' ? (
          variant === 'compact' ? (
            <Compact approval={approval} role={role} />
          ) : (
            <Full approval={approval} role={role} on={on} />
          )
        ) : approval.stage === 'held' ? (
          <Held approval={approval} />
        ) : (
          <ReceiptLine
            text={receiptText(approval)}
            icon={
              approval.stage === 'declined'
                ? 'close-circle-outline'
                : // A preview moved nothing: no green check that could read as paid
                  approval.preview && approval.chose === 'verb'
                  ? 'information-circle-outline'
                  : 'checkmark-circle'
            }
            onUndo={
              approval.stage === 'declined' || approval.chose === 'alt'
                ? () => wed.undo(approval.id)
                : undefined
            }
          />
        )}
        {approval.stage === 'done' && approval.chats?.length ? (
          <OpenChats chats={approval.chats} />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

function Full({
  approval,
  role,
  on,
}: {
  approval: Approval;
  role: Role;
  on: 'canvas' | 'grouped';
}) {
  const styles = useStyles();
  const approve = useApprove(approval);
  const list = useGuestList(approval.guests?.to);
  // A send to guests waits until their list is found (signed out, Send asks to sign in)
  const blocked = !!approval.guests && list.status !== 'ready' && list.status !== 'signedOut';
  return (
    <>
      {/* On Updates the section title already says it: just Coming later */}
      <Eyebrow preview={approval.preview} role={role} bare={on === 'grouped'} />
      <AppText variant="heading" accessibilityRole="header">
        {approval.title}
      </AppText>
      {approval.guests ? (
        <GuestDetails
          id={approval.id}
          send={approval.guests}
          list={list}
          editable={role === 'owner'}
        />
      ) : (
        <People people={approval.to} ring={on === 'canvas' ? 'canvasCard' : 'surface'} />
      )}
      <View style={styles.facts}>
        <Fact icon="calendar-outline" label="For" text={approval.forLine} />
        <Fact icon="lock-closed-outline" label="Shares" text={approval.shares} />
        <Fact icon="card-outline" label="Cost" text={approval.cost} />
        {/* Only the one who says yes can undo it */}
        {role === 'owner' ? <Fact icon="time-outline" label="Undo" text={approval.undo} /> : null}
      </View>
      {approval.message !== undefined && (
        <Message id={approval.id} text={approval.message} editable={role === 'owner'} />
      )}
      <AppText variant="label" weight={400} color="text2">
        {footerFor(approval, role)}
      </AppText>
      <View style={styles.buttons}>
        {role === 'owner' ? (
          <>
            <Button label={approval.verb} disabled={blocked} onPress={approve} />
            {approval.altLabel ? (
              <Button
                label={approval.altLabel}
                variant="neutral"
                onPress={() => wed.alt(approval.id)}
              />
            ) : null}
            <NotNow id={approval.id} />
          </>
        ) : role === 'suggester' ? (
          <>
            {approval.suggested ? (
              <ReceiptLine text={`Suggested to ${FAMILY.owner}`} />
            ) : (
              <Button
                label={`Suggest to ${FAMILY.owner}`}
                variant="neutral"
                onPress={() => wed.suggest(approval.id)}
              />
            )}
            <NotNow id={approval.id} />
          </>
        ) : approval.reminded ? (
          <ReceiptLine text={`Reminded ${FAMILY.owner}`} />
        ) : (
          <Button
            label={`Remind ${FAMILY.owner}`}
            variant="neutral"
            onPress={() => wed.remind(approval.id)}
          />
        )}
      </View>
    </>
  );
}

/**
 * Home's short card: what and when in full (never cut off: they're what
 * the yes is for), then the message and what it shares, before its buttons.
 */
function Compact({ approval, role }: { approval: Approval; role: Role }) {
  const styles = useStyles();
  const approve = useApprove(approval);
  // Two buttons side by side until the text gets big, then one above the other
  const stack = useFontScale('button') > 1.3;
  const lookFirst = (
    <Button
      label="Look first"
      variant="neutral"
      style={!stack && styles.half}
      onPress={() => openWed({ focus: approval.id })}
    />
  );

  return (
    <>
      {/* Home's section title already says Needs your OK: just Coming later */}
      {approval.preview ? <Eyebrow preview bare /> : null}
      <View style={styles.titleBlock}>
        <AppText variant="heading">{approval.title}</AppText>
        <AppText color="text2">{approval.forLine}</AppText>
      </View>
      {approval.message !== undefined && (
        <View style={styles.message}>
          <AppText color="text2" numberOfLines={3}>
            {approval.message}
          </AppText>
        </View>
      )}
      <AppText color="text2">{`${approval.sharesShort} · ${approval.cost}`}</AppText>
      <View style={[styles.pair, stack && styles.stacked]}>
        {role === 'owner' ? (
          <Button label={approval.verb} style={!stack && styles.half} onPress={approve} />
        ) : role === 'suggester' ? (
          <Button
            label={approval.suggested ? 'Suggested' : `Suggest to ${FAMILY.owner}`}
            variant="neutral"
            disabled={approval.suggested}
            style={!stack && styles.half}
            onPress={() => wed.suggest(approval.id)}
          />
        ) : (
          <Button
            label={approval.reminded ? 'Reminded' : `Remind ${FAMILY.owner}`}
            variant="neutral"
            disabled={approval.reminded}
            style={!stack && styles.half}
            onPress={() => wed.remind(approval.id)}
          />
        )}
        {lookFirst}
      </View>
    </>
  );
}

/** Ten seconds after a yes: one line, and Undo counting down. */
function Held({ approval }: { approval: Approval }) {
  const styles = useStyles();
  const Colors = useColors();
  const left = useSecondsLeft(approval.heldUntil);
  return (
    <View style={styles.line}>
      <Icon name="checkmark-circle" size={22} color={Colors.success} />
      <AppText style={styles.grow}>{approval.heldText}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Undo, ${left} seconds left`}
        onPress={() => wed.undo(approval.id)}
        hitSlop={4}
        style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
      >
        <AppText weight={600} color="primary">
          {`Undo (${left} s)`}
        </AppText>
      </Pressable>
    </View>
  );
}

/**
 * A finished thing, on one line: a green check, the words in grey, and Undo
 * when it can still be undone. The thread's receipt rows use it too.
 */
export function ReceiptLine({
  text,
  icon = 'checkmark-circle',
  onUndo,
  undone = false,
}: {
  text: string;
  icon?: IconName;
  onUndo?: () => void;
  /** Struck through after Undo. */
  undone?: boolean;
}) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Icon
        name={undone ? 'arrow-undo' : icon}
        size={20}
        color={icon === 'checkmark-circle' && !undone ? Colors.success : Colors.text2}
      />
      <AppText color="text2" style={[styles.grow, undone && styles.undone]}>
        {text}
      </AppText>
      {onUndo && !undone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Undo: ${text}`}
          onPress={onUndo}
          hitSlop={4}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <AppText weight={600} color="primary">
            Undo
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The yes. A card that sends a message asks the family to sign in first, as it goes from them. */
function useApprove(approval: Approval) {
  const { requireSignIn } = useSession();
  return () =>
    (SENDS.includes(approval.kind) || approval.kind === 'invite') && !approval.preview
      ? requireSignIn(() => wed.approve(approval.id))
      : wed.approve(approval.id);
}

/** Once sent, the way into the real chat in Messages, to carry on there. */
function OpenChats({ chats }: { chats: string[] }) {
  return (
    <Button
      variant="text"
      icon="chatbubbles-outline"
      label={chats.length === 1 ? 'Open the chat' : `Open Messages (${chats.length} chats)`}
      onPress={() =>
        router.push(
          chats.length === 1 ? { pathname: '/chat/[id]', params: { id: chats[0] } } : '/messages',
        )
      }
    />
  );
}

/** Not now: plain and grey, the quietest choice on the card. */
function NotNow({ id }: { id: string }) {
  return (
    <Button label="Not now" variant="plain" labelColor="text2" onPress={() => wed.decline(id)} />
  );
}

/**
 * "Needs your OK" with the mark (for someone who can't say yes, "You can
 * suggest this" or "Waiting for Simran's OK"), and Coming later on
 * previews; `bare` is the pill alone.
 */
function Eyebrow({
  preview,
  role = 'owner',
  bare = false,
}: {
  preview?: boolean;
  role?: Role;
  bare?: boolean;
}) {
  const styles = useStyles();
  if (bare && !preview) return null;
  const words =
    role === 'owner'
      ? 'Needs your OK'
      : role === 'suggester'
        ? 'You can suggest this'
        : `Waiting for ${FAMILY.owner}'s OK`;
  return (
    <View style={styles.eyebrow}>
      {bare ? null : (
        <>
          <WedMark size={16} />
          <AppText variant="label" weight={600} color="text2">
            {words}
          </AppText>
        </>
      )}
      {preview ? (
        <View style={styles.later}>
          <AppText variant="label" weight={600} color="kesari">
            Coming later
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Who it goes to: overlapping faces, then the names. */
function People({ people, ring }: { people: Approval['to']; ring: 'canvasCard' | 'surface' }) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.people}>
      <View style={styles.faces}>
        {people.map((person, index) => (
          <View
            key={person.name}
            style={[styles.face, { borderColor: Colors[ring] }, index > 0 && styles.overlap]}
          >
            {person.photo ? (
              <Image
                source={{ uri: person.photo }}
                placeholder={person.blurhash ? { blurhash: person.blurhash } : undefined}
                contentFit="cover"
                style={styles.photo}
                accessible={false}
              />
            ) : (
              <AppText variant="label" weight={600} color="text2">
                {person.name.slice(0, 1)}
              </AppText>
            )}
          </View>
        ))}
      </View>
      <AppText style={styles.grow}>{people.map((person) => person.name).join(', ')}</AppText>
    </View>
  );
}

/** One fact with its icon level with the first line: "For: Jaago · Fri, Jun 12, 2027". */
function Fact({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('body');
  const { lineHeight } = useTypeStyle({});
  return (
    <View style={styles.fact}>
      <View style={[styles.factIcon, { height: lineHeight * scale, width: Sizes.icon * scale }]}>
        <Icon name={icon} size={Sizes.iconSmall * scale} color={Colors.text2} />
      </View>
      <AppText style={styles.grow}>
        <AppText weight={600}>{`${label}: `}</AppText>
        {text}
      </AppText>
    </View>
  );
}

/** The exact message, in full, with Change to edit it in place. */
function Message({ id, text, editable }: { id: string; text: string; editable: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const { maxFontSizeMultiplier, ...font } = useTypeStyle({});

  const done = () => {
    wed.editMessage(id, draft.trim() || text);
    setEditing(false);
  };

  return (
    <View style={styles.message}>
      {/* "Message", with Change at the right of the same line */}
      <View style={styles.messageHead}>
        <AppText variant="label" weight={600} color="text2" style={styles.grow}>
          Message
        </AppText>
        {editable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Done changing the message' : 'Change the message'}
            onPress={
              editing
                ? done
                : () => {
                    setDraft(text);
                    setEditing(true);
                  }
            }
            hitSlop={8}
            style={({ pressed }) => [styles.change, pressed && styles.pressed]}
          >
            <AppText weight={600}>{editing ? 'Done' : 'Change'}</AppText>
          </Pressable>
        ) : null}
      </View>
      {editing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          accessibilityLabel="The message"
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={[font, styles.input, { color: Colors.text }]}
        />
      ) : (
        <AppText>{text}</AppText>
      )}
    </View>
  );
}

function footerFor(approval: Approval, role: Role): string {
  if (role === 'suggester') return `${FAMILY.owner} will see it in Suggestions`;
  if (approval.footer) return approval.footer;
  return approval.kind === 'ask'
    ? `${FAMILY.approvers} can say yes. Wed asks at most 5 vendors an hour and 15 a day.`
    : `${FAMILY.approvers} can say yes.`;
}

// Seconds of Undo left, ticking down
function useSecondsLeft(until: number | undefined) {
  const [left, setLeft] = useState(10);
  useEffect(() => {
    if (until === undefined) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);
  return left;
}

const FACE = 32;

const useStyles = makeStyles((Colors) => ({
  card: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  open: {
    padding: Spacing.lg,
  },
  closed: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  // A finished card in the thread is just its receipt line, like other receipts
  bare: {
    paddingHorizontal: 0,
  },
  onCanvas: {
    backgroundColor: Colors.canvasCard,
  },
  onGrouped: {
    backgroundColor: Colors.surface,
  },
  stage: {
    gap: Spacing.md,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  later: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.chip,
    backgroundColor: Colors.kesariTint,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  faces: {
    flexDirection: 'row',
  },
  face: {
    width: FACE + 4,
    height: FACE + 4,
    borderRadius: (FACE + 4) / 2,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.skeleton,
  },
  overlap: {
    marginLeft: -Spacing.sm - 4,
  },
  photo: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
  },
  facts: {
    gap: Spacing.sm,
  },
  fact: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  factIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.field,
    backgroundColor: Colors.fill,
  },
  messageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    // Change's tap area reaches into the box's padding instead of adding height
    marginVertical: -Spacing.sm,
  },
  change: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  titleBlock: {
    gap: Spacing.xs,
  },
  input: {
    padding: 0,
    minHeight: 96,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  buttons: {
    gap: Spacing.sm,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stacked: {
    flexDirection: 'column',
  },
  half: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  line: {
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  textButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  undone: {
    textDecorationLine: 'line-through',
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.5,
  },
}));
