import type { VoiceContentType } from '@/data/chat';

/** Shorter than this is a slip of the finger, not a voice note. */
export const MIN_VOICE_MS = 1000;

/** "0:07", "1:05", "12:30": a voice note's length or position. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The recording's type from its file: browsers record WebM, phones an AAC
 * file in an MP4 (.m4a) box.
 */
export function voiceContentType(uri: string): VoiceContentType {
  const clean = uri.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith('.webm') || clean.startsWith('blob:')) return 'audio/webm';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  if (clean.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}
