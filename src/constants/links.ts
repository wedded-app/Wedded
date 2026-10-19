import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

/**
 * The app's own link scheme, from `scheme` in app.json: weddingapp://v/{slug}
 * opens a profile in the installed app. Keep the two in step.
 */
export const APP_SCHEME = 'weddingapp';

/** A path in the installed app, for "Open in the app" on the web. */
export function appLink(path: string): string {
  return `${APP_SCHEME}://${path.replace(/^\//, '')}`;
}

// The website that serves /v/{slug} to people without the app. There's no
// domain yet, so until EXPO_PUBLIC_SITE_URL is set this is a placeholder, and
// the QR table tent says not to print.
const PLACEHOLDER_SITE_URL = 'https://weddingapp.example';

export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || PLACEHOLDER_SITE_URL).replace(
  /\/+$/,
  '',
);

export const SITE_URL_IS_PLACEHOLDER = !process.env.EXPO_PUBLIC_SITE_URL;

/** A page on the website, e.g. siteLink('/v/royal-orchard') for a QR code. */
export function siteLink(path: string): string {
  return `${SITE_URL}/${path.replace(/^\//, '')}`;
}

/**
 * A link someone else opens to land on `path` (an invite, an RSVP): the
 * website once there's a domain, else this app's own address. Expo Go can
 * only load a published update from that address with its channel, which
 * createURL leaves off ("channel-name: Required"); EAS names the branch after
 * the channel, so the update's branch is the channel.
 */
export function shareLink(path: string): string {
  if (!SITE_URL_IS_PLACEHOLDER) return siteLink(path);
  const branch = (Constants.manifest2?.metadata as { branchName?: string } | undefined)?.branchName;
  return Linking.createURL(path, branch ? { queryParams: { 'channel-name': branch } } : undefined);
}
