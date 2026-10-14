import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColors } from '@/constants/theme';

/** The orb's colours in a browser, which has no mesh gradient: soft radial lights on maroon. */
export function OrbMesh() {
  const Colors = useColors();
  const glow = (color: string, at: string, reach: number) =>
    `radial-gradient(circle at ${at}, ${color} 0%, ${clear(color)} ${reach}%)`;
  const image = [
    glow(Colors.petalBlush, '38% 42%', 45),
    glow(Colors.petalGold, '72% 70%', 40),
    glow(Colors.heroTo, '60% 20%', 60),
  ].join(', ');
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: Colors.heroFrom, backgroundImage: image } as unknown as ViewStyle,
      ]}
    />
  );
}

// The same colour at no opacity, so a fade never turns grey
function clear(color: string) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
  }
  return color.replace(/[\d.]+\)$/, '0)');
}
