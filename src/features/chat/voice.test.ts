import { formatDuration, voiceContentType } from './voice';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('voice notes', () => {
  it('writes lengths the way phones do', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7400)).toBe('0:07');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(300_000)).toBe('5:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('knows the type from the file', () => {
    expect(voiceContentType('file:///cache/rec-1.m4a')).toBe('audio/mp4');
    expect(voiceContentType('file:///cache/rec-1.MP3')).toBe('audio/mpeg');
    expect(voiceContentType('blob:https://app/123')).toBe('audio/webm');
    expect(voiceContentType('https://x/rec.webm?token=1')).toBe('audio/webm');
    expect(voiceContentType('file:///rec.aac')).toBe('audio/aac');
  });
});
