import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/** "2:05 PM". Times keep Latin digits in both languages (vision §4). */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/**
 * One message's place in a thread: mine on the right, theirs on the left, at
 * most four fifths of the width, and under the last of a run its time (and
 * "Seen" when the other side has read it). Holds a bubble or a card.
 */
export function MessageRow({
  mine,
  last,
  seen,
  createdAt,
  wide = false,
  children,
}: {
  /** Cards (quote, menu, inquiry) take the row's full width instead of shrinking to fit. */
  wide?: boolean;
  mine: boolean;
  last: boolean;
  seen: boolean;
  createdAt: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <View
      style={[
        styles.row,
        wide && styles.wide,
        mine ? styles.mine : styles.theirs,
        last && styles.runEnd,
      ]}
    >
      <View style={[styles.content, wide && styles.fill]}>{children}</View>
      {last && (
        <AppText variant="caption" color="text2" style={mine ? styles.metaMine : null}>
          {seen ? `${formatClock(createdAt)} · ${t('chat.seen')}` : formatClock(createdAt)}
        </AppText>
      )}
    </View>
  );
}

/**
 * A text bubble: the app colour for mine, white for theirs, with the corner
 * nearest the next bubble tucked in when several come in a row.
 */
export function TextBubble({
  text,
  mine,
  first,
  last,
}: {
  text: string;
  mine: boolean;
  first: boolean;
  last: boolean;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.bubbleMine : styles.bubbleTheirs,
        mine ? !last && styles.tuckMineBottom : !last && styles.tuckTheirsBottom,
        mine ? !first && styles.tuckMineTop : !first && styles.tuckTheirsTop,
      ]}
    >
      <AppText variant="bodyLg" color={mine ? 'onPrimary' : 'text'} selectable>
        {text}
      </AppText>
    </View>
  );
}

/** A photo sent in chat; tap to see it full screen. */
export function PhotoBubble({ url, label }: { url: string; label: string }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
      >
        <Image source={{ uri: url }} contentFit="cover" accessible={false} style={styles.photo} />
      </Pressable>
      <PhotoViewer url={url} label={label} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The whole photo on black, like the gallery: Close is always there, so nobody needs a gesture. */
function PhotoViewer({
  url,
  label,
  visible,
  onClose,
}: {
  url: string;
  label: string;
  visible: boolean;
  onClose: () => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('body'), 1.4);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('gallery.close')}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Icon
            name="close"
            size={Sizes.iconSmall * scale}
            color={Colors.onPrimary}
            weight="bold"
          />
          <AppText variant="button" color="onPrimary">
            {t('gallery.close')}
          </AppText>
        </Pressable>
        <Image
          source={{ uri: url }}
          contentFit="contain"
          accessibilityLabel={label}
          style={styles.whole}
        />
      </View>
    </Modal>
  );
}

const BIG = 20;
const TUCK = 6;

const useStyles = makeStyles((Colors) => ({
  row: {
    maxWidth: '82%',
    gap: 3,
    marginTop: 2,
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  wide: {
    width: '86%',
    maxWidth: 420,
  },
  fill: {
    alignSelf: 'stretch',
  },
  runEnd: {
    marginBottom: Spacing.sm,
  },
  content: {
    maxWidth: '100%',
  },
  metaMine: {
    textAlign: 'right',
  },
  bubble: {
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BIG,
    borderCurve: 'continuous',
  },
  bubbleMine: {
    backgroundColor: Colors.primaryFill,
  },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
  },
  tuckMineBottom: { borderBottomRightRadius: TUCK },
  tuckMineTop: { borderTopRightRadius: TUCK },
  tuckTheirsBottom: { borderBottomLeftRadius: TUCK },
  tuckTheirsTop: { borderTopLeftRadius: TUCK },
  photo: {
    width: 240,
    height: 240,
    borderRadius: Radius.photo,
    backgroundColor: Colors.skeleton,
  },
  viewer: {
    flex: 1,
    backgroundColor: Colors.viewer,
  },
  // The gallery's dark glass capsule
  close: {
    alignSelf: 'flex-start',
    minHeight: Sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Sizes.pageGutter,
    marginVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.lg,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(120, 120, 128, 0.36)',
  },
  closePressed: {
    backgroundColor: 'rgba(120, 120, 128, 0.56)',
  },
  whole: {
    flex: 1,
  },
}));
