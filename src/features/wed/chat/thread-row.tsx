import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';

import { ApprovalCard, ReceiptLine } from '../approval-card';
import { libraryList, type MockVendor } from '../mock';
import { CardsRow } from '../wed-cards';
import { getWed, wed, type ChatItem } from '../wed-store';

import { StarterRows } from './greeting';
import { VendorCarousel } from './vendor-carousel';
import { WorkLine } from './work-line';

// Wed's words arrive a sentence at a time, this far apart
const SENTENCE_MS = 450;
// With Reduce Motion a new message still fades in, all at once (a fade isn't motion)
const FADE_WHOLE = FadeIn.duration(300).reduceMotion(ReduceMotion.Never);

/**
 * One row of the Wed thread, by kind: what the family said (a grey bubble on
 * the right), Wed's words (plain text on the page, no bubble), a day line,
 * Wed at work, vendors it found, a card waiting for a yes, a receipt, a
 * vendor's reply, invitation cards, or a list Wed made. `fresh` is true for
 * rows that arrived while the chat was open, so Wed's words appear sentence
 * by sentence. Rows are kept as they are in the store, so only one that
 * changed redraws.
 */
export const ThreadRow = memo(function ThreadRow({
  item,
  fresh,
}: {
  item: ChatItem;
  fresh: boolean;
}) {
  switch (item.kind) {
    case 'me':
      return <MeRow text={item.text} photo={item.photo} spoken={item.spoken} about={item.about} />;
    case 'wed':
      return <WedWords text={item.text} fresh={fresh} />;
    case 'divider':
      return <DayLine text={item.text} />;
    case 'work':
      return <WorkLine taskId={item.taskId} />;
    case 'vendors':
      return <VendorCarousel vendors={item.vendors} found={item.found} checked={item.checked} />;
    case 'approval':
      return <ApprovalRow id={item.id} fresh={fresh} />;
    case 'receipt':
      return (
        <ReceiptLine
          text={item.text}
          undone={item.undone}
          onUndo={item.undoFlow ? () => wed.undoReceipt(item.key) : undefined}
        />
      );
    case 'reply':
      return <ReplyRow vendor={item.vendor} who={item.who} text={item.text} />;
    case 'cards':
      return <CardsRow events={item.events} />;
    case 'artifact':
      return <ArtifactRow id={item.id} gone={item.gone} />;
    case 'starters':
      return <StarterRows />;
  }
});

/** The family's own words (or photo), on the right in a grey bubble. */
function MeRow({
  text,
  photo,
  spoken,
  about,
}: {
  text: string;
  photo?: string;
  spoken?: boolean;
  about?: string;
}) {
  const styles = useStyles();
  const meta = [spoken ? 'Spoken' : null, about ? `About ${about}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.mine}>
      {meta ? (
        <AppText variant="label" weight={400} color="text2" numberOfLines={1}>
          {meta}
        </AppText>
      ) : null}
      {photo ? (
        <Image
          source={{ uri: photo }}
          contentFit="cover"
          accessibilityLabel="Your photo"
          style={styles.photo}
        />
      ) : null}
      {text ? (
        <View style={styles.bubble}>
          <AppText>{text}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Wed's words, on the page with no bubble. A new message appears sentence by
 * sentence: the whole paragraph is laid out from the start with the later
 * sentences see-through, so nothing below it jumps as they arrive.
 */
function WedWords({ text, fresh }: { text: string; fresh: boolean }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const sentences = useMemo(() => splitSentences(text), [text]);
  const [shown, setShown] = useState(fresh && !reduceMotion ? 1 : sentences.length);

  useEffect(() => {
    if (shown >= sentences.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), SENTENCE_MS);
    return () => clearTimeout(timer);
  }, [shown, sentences.length]);

  // A new answer is read out once it's all there (iOS has no live regions)
  useEffect(() => {
    if (fresh && shown >= sentences.length) AccessibilityInfo.announceForAccessibility(text);
  }, [fresh, shown, sentences.length, text]);

  return (
    <Animated.View entering={fresh && reduceMotion ? FADE_WHOLE : undefined}>
      <AppText accessibilityLabel={text}>
        {sentences.map((sentence, index) => (
          <Text key={index} style={index >= shown && styles.unseen}>
            {sentence}
          </Text>
        ))}
      </AppText>
    </Animated.View>
  );
}

/** A card waiting for a yes; one that just arrived is read out, so nobody misses it. */
function ApprovalRow({ id, fresh }: { id: string; fresh: boolean }) {
  useEffect(() => {
    if (!fresh) return;
    const approval = getWed().approvals.find((a) => a.id === id);
    if (approval?.stage === 'waiting') {
      AccessibilityInfo.announceForAccessibility(`Needs your OK: ${approval.title}`);
    }
  }, [fresh, id]);
  return <ApprovalCard id={id} on="canvas" />;
}

/** "Yesterday", "While you were away": small words between two hairlines. */
function DayLine({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.day} accessibilityRole="header">
      <View style={styles.hairline} />
      <AppText variant="label" weight={400} color="text2">
        {text}
      </AppText>
      <View style={styles.hairline} />
    </View>
  );
}

/** A vendor's answer, quoted in the thread: their face, who said it, their words on the left. */
function ReplyRow({ vendor, who, text }: { vendor: MockVendor; who: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.reply}>
      <Image
        source={{ uri: vendor.photo }}
        placeholder={{ blurhash: vendor.blurhash }}
        contentFit="cover"
        accessible={false}
        style={styles.avatar}
      />
      <View style={styles.replyWords}>
        <AppText variant="label" weight={600} numberOfLines={1}>
          {`${who} · ${vendor.name}`}
        </AppText>
        <View style={styles.theirs}>
          <AppText>{text}</AppText>
        </View>
      </View>
    </View>
  );
}

/**
 * A list Wed made ("Dhol players compared"), opening Lists and photos. Once
 * its app is disconnected (Gmail's emails) it stays, struck through, and
 * opens nothing.
 */
function ArtifactRow({ id, gone = false }: { id: string; gone?: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = Math.min(useFontScale('body'), 1.4);
  const list = libraryList(id);
  if (!list) return null;
  if (gone) {
    return (
      <View style={styles.artifact} accessible accessibilityLabel={`${list.title}, forgotten`}>
        <View style={styles.artifactIcon}>
          <Icon name={list.icon} size={Math.round(22 * scale)} color={Colors.text2} />
        </View>
        <View style={styles.grow}>
          <AppText weight={600} color="text2" style={styles.struck}>
            {list.title}
          </AppText>
          <AppText variant="label" weight={400} color="text2">
            Forgotten when Gmail was disconnected
          </AppText>
        </View>
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${list.title}, made by Wed today`}
      accessibilityHint="Opens Lists and photos"
      onPress={() => router.push('/wed/library')}
      style={styles.artifact}
    >
      <View style={styles.artifactIcon}>
        <Icon name={list.icon} size={Math.round(22 * scale)} color={Colors.text} />
      </View>
      <View style={styles.grow}>
        <AppText weight={600}>{list.title}</AppText>
        <AppText variant="label" weight={400} color="text2">
          Made by Wed · Today
        </AppText>
      </View>
      <Icon
        name="chevron-forward"
        size={Math.round(17 * scale)}
        color={Colors.chevron}
        weight="semibold"
      />
    </PressableScale>
  );
}

/**
 * "Okay. I'll ask before everything." → ["Okay. ", "I'll ask before
 * everything."]: breaks after . ! or ? when a space follows, so "$6,000"
 * and "9:41" stay whole.
 */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const end = '.!?'.includes(text[i]) && (i + 1 === text.length || text[i + 1] === ' ');
    if (!end) continue;
    let next = i + 1;
    while (text[next] === ' ') next++;
    parts.push(text.slice(start, next));
    start = next;
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts.length > 0 ? parts : [text];
}

const AVATAR = 32;

const useStyles = makeStyles((Colors) => ({
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '82%',
    gap: Spacing.xs,
  },
  bubble: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface2,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    backgroundColor: Colors.skeleton,
  },
  unseen: {
    color: 'transparent',
  },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    maxWidth: '88%',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: Colors.skeleton,
  },
  replyWords: {
    flexShrink: 1,
    gap: Spacing.xs,
  },
  theirs: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
  },
  artifact: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.canvasCard,
  },
  artifactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  grow: {
    flex: 1,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
}));
