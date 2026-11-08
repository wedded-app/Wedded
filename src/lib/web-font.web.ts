import { Asset } from 'expo-asset';

const STYLE_ID = 'wedded-inter';

/**
 * Registers Inter for the web build (WEB_FONT in constants/theme.ts). Macs and
 * iPhones still draw SF Pro; Windows, Linux and Android browsers have no SF,
 * so they get Inter, the font the redesign canvas shows in its place, instead
 * of Segoe UI or Roboto. One variable file covers every weight, it ships with
 * the app (no font service sees the visitor), and text shows in the fallback
 * until it arrives instead of waiting.
 */
export function installWebFont() {
  // Static rendering has no document; the browser adds the font when it loads
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  // Expo's lint allows require() for .ttf and .otf assets but not .woff2
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { uri } = Asset.fromModule(require('../../assets/fonts/inter-latin-variable.woff2'));
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url("${uri}") format("woff2");}`;
  document.head.appendChild(style);
}
