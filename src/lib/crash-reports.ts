/**
 * Crash and error reports go to Sentry (#273), with nothing personal in them.
 * Imported first by the root layout, so errors while the app loads are caught.
 * Expo Go reports JavaScript errors only; native crashes start with the first
 * real app build. No DSN (CI, local) or the dev server means no Sentry at all.
 */
import * as Sentry from '@sentry/react-native';

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[a-z]{2,}/gi;
// A run of digits with phone separators, not inside an id like a UUID
const PHONE = /(^|[^\w-])(\+?\(?\d[\d\s().-]{8,}\d)/g;

function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(PHONE, (match, before: string, run: string) => {
    const digits = run.replace(/\D/g, '').length;
    return digits >= 10 && digits <= 15 ? `${before}[phone]` : match;
  });
}

function scrub(value: unknown, key?: string): unknown {
  // Query strings can carry tokens and search terms, so URLs lose them
  if (typeof value === 'string') return scrubText(key === 'url' ? value.split('?')[0] : value);
  if (Array.isArray(value)) return value.map((item) => scrub(item));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Stack traces are code locations, and the file names hold long numbers
    for (const k of Object.keys(record)) if (k !== 'stacktrace') record[k] = scrub(record[k], k);
  }
  return value;
}

/**
 * Drops who the person is (user, device name, request bodies, console logs)
 * and masks emails and phone numbers anywhere else in the report.
 * shortcut: a name typed into an error message's text isn't masked; drop
 * `exception.values[].value` too if one ever shows up in Sentry.
 */
export function stripPersonalDetails<T extends Sentry.ErrorEvent>(event: T): T {
  delete event.user;
  delete event.request;
  delete event.contexts?.device?.name;
  event.breadcrumbs = event.breadcrumbs?.filter((crumb) => crumb.category !== 'console');
  return scrub(event) as T;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    enabled: !__DEV__,
    sendDefaultPii: false,
    beforeSend: stripPersonalDetails,
  });
}

export { captureException as reportCrash } from '@sentry/react-native';
