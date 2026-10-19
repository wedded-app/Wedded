import Svg, { Path, Rect } from 'react-native-svg';

/**
 * The Memory Vault's mark: a padlock with a heart on it. Neither SF Symbols
 * nor Ionicons has one, so it's drawn here on the same 24-point grid and
 * sized like Icon. Decorative, like Icon: the words beside it say what it is.
 */
export function VaultIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Rect
        x={4.5}
        y={10}
        width={15}
        height={11.5}
        rx={3}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
      />
      <Path
        d="M12 18.45L11.56 18.05C10.02 16.65 9 15.73 9 14.6C9 13.67 9.73 12.95 10.65 12.95C11.17 12.95 11.67 13.19 12 13.57C12.33 13.19 12.83 12.95 13.35 12.95C14.27 12.95 15 13.67 15 14.6C15 15.73 13.98 16.65 12.44 18.06L12 18.45Z"
        fill={color}
      />
    </Svg>
  );
}
