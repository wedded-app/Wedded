import { toDateString } from '@/features/inquiry/inquiry-helpers';

/** A video's length as on a phone's camera roll: "0:42", "1:05". */
export function videoLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The event on today's date (yyyy-mm-dd, the phone's own day), so a guest at it adds to it. */
export function todaysEvent<T extends { date: string | null }>(
  events: T[],
  today = toDateString(new Date()),
): T | undefined {
  return events.find((event) => event.date === today);
}

/** The file name to save a vault item under, keeping its file's extension so Photos knows the kind. */
export function savedName(id: string, path: string, kind: 'photo' | 'video'): string {
  const ext = /\.(\w{3,4})$/.exec(path.split('?')[0] ?? '')?.[1];
  return `vault-${id}.${ext ?? (kind === 'video' ? 'mp4' : 'jpg')}`;
}
