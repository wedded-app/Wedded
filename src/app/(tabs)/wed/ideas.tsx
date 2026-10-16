import { View } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { IDEAS, type MockIdea } from '@/features/wed/mock';
import { openWed, WED_BACK } from '@/features/wed/open-wed';

/**
 * Ideas: things Wed can start from the family's plan, each with why it
 * comes up now. Start sends the idea to Wed and opens the chat, where it
 * plays like anything typed. Starting is safe: whatever would reach a vendor
 * still waits on a card for the family's yes.
 */
export default function WedIdeasScreen() {
  const styles = useStyles();
  return (
    <NavScreen title="Ideas" subtitle="From your plan. Wed can do all of these." backTo={WED_BACK}>
      <View style={styles.list}>
        {IDEAS.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </View>
    </NavScreen>
  );
}

/** One idea: a glyph, what Wed would do, why, and Start (See how it works for a later feature). */
function IdeaCard({ idea }: { idea: MockIdea }) {
  const Colors = useColors();
  const styles = useStyles();
  // The glyph's circle keeps up with the text, but not past the point where
  // it would squeeze the words
  const scale = Math.min(useFontScale('body'), 1.3);
  const circle = Sizes.iconCircle * scale;

  return (
    <View style={styles.card}>
      <View style={[styles.circle, { width: circle, height: circle, borderRadius: circle / 2 }]}>
        <Icon name={idea.icon} size={Sizes.icon * scale} color={Colors.text} />
      </View>
      <View style={styles.body}>
        <View style={styles.words}>
          <AppText weight={600}>{idea.title}</AppText>
          <AppText color="text2">{idea.why}</AppText>
        </View>
        <Button
          label={idea.preview ? 'See how it works' : 'Start'}
          variant="neutral"
          accessibilityLabel={`${idea.preview ? 'See how it works' : 'Start'}: ${idea.title}`}
          onPress={() => openWed({ ask: idea.ask, send: true })}
          style={styles.start}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  body: {
    flex: 1,
    gap: Spacing.md,
  },
  words: {
    gap: 2,
  },
  start: {
    alignSelf: 'flex-start',
  },
}));
