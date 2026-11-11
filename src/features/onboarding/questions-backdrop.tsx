import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { backgroundCss, useColors } from '@/constants/theme';

/**
 * Behind the first questions: the white page with a little colour, as Fezy
 * asked (2026-11-11). A blush wash at the top that's gone a third of the way
 * down, and a faint rose light in the top corner. It stands still, so it
 * never competes with the question, and the answers sit on white.
 */
export function QuestionsBackdrop() {
  const Colors = useColors();
  const { width } = useWindowDimensions();
  const light = width * 1.3;
  // Fading to the same colour at no opacity, not "transparent" (black at no
  // opacity), keeps the edge from turning grey
  const clear = (color: string) => color.replace(/[\d.]+\)$/, '0)');

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.wash,
          backgroundCss(
            `linear-gradient(180deg, ${Colors.washBlush} 0%, ${clear(Colors.washBlush)} 100%)`,
          ),
        ]}
      />
      <View
        style={[
          styles.light,
          { width: light, height: light, top: -light * 0.55, right: -light * 0.45 },
          backgroundCss(
            `radial-gradient(circle, ${Colors.washRose} 0%, ${clear(Colors.washRose)} 70%)`,
          ),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
  },
  light: {
    position: 'absolute',
  },
});
