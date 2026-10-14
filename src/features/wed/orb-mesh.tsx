import { MeshGradientView } from 'expo-mesh-gradient';
import { StyleSheet } from 'react-native';

import { useColors, type Palette } from '@/constants/theme';

// A 3x3 mesh: maroon at the edges, rose and blush in the middle, a touch of
// gold low on one side, like light on satin.
const meshColors = (Colors: Palette) => [
  Colors.heroFrom,
  Colors.heroTo,
  Colors.heroFrom,
  Colors.heroTo,
  Colors.petalBlush,
  Colors.petalGold,
  Colors.heroFrom,
  Colors.petalRose,
  Colors.heroTo,
];
const POINTS: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.45],
  [0.42, 0.52],
  [1, 0.6],
  [0, 1],
  [0.55, 1],
  [1, 1],
];

/** The orb's colours as Apple's mesh gradient (the web draws soft lights instead). */
export function OrbMesh() {
  const Colors = useColors();
  return (
    <MeshGradientView
      style={StyleSheet.absoluteFill}
      columns={3}
      rows={3}
      colors={meshColors(Colors)}
      points={POINTS}
    />
  );
}
