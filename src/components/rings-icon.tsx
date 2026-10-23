import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Two wedding rings with a small stone, for the Wedding tab: SF Symbols has
 * no rings, so it's drawn here in the same weight as the other tab icons
 * (thicker when the tab is selected).
 */
export function RingsIcon({
  size = 24,
  color,
  selected = false,
}: {
  size?: number;
  color: string;
  selected?: boolean;
}) {
  const stroke = selected ? 2.2 : 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={14} r={5} stroke={color} strokeWidth={stroke} />
      <Circle cx={15} cy={14} r={5} stroke={color} strokeWidth={stroke} />
      <Path
        d="m12 3 1.6 2L12 7l-1.6-2z"
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
        fill={selected ? color : 'none'}
      />
    </Svg>
  );
}
