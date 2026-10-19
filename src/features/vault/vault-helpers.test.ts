import { savedName, todaysEvent, videoLength } from './vault-helpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('videoLength', () => {
  it('reads like the camera roll', () => {
    expect(videoLength(0)).toBe('0:00');
    expect(videoLength(42.4)).toBe('0:42');
    expect(videoLength(65)).toBe('1:05');
  });
});

describe('todaysEvent', () => {
  const events = [
    { id: 'a', date: '2027-04-23' },
    { id: 'b', date: null },
    { id: 'c', date: '2027-04-24' },
  ];
  it('finds the event on that day', () => {
    expect(todaysEvent(events, '2027-04-24')?.id).toBe('c');
  });
  it('is undefined on other days', () => {
    expect(todaysEvent(events, '2027-05-01')).toBeUndefined();
  });
});

describe('savedName', () => {
  it('keeps the extension from a signed link', () => {
    expect(savedName('x', 'https://s3/v/u/x.mov?X-Amz-Signature=abc', 'video')).toBe('vault-x.mov');
  });
  it('falls back by kind', () => {
    expect(savedName('x', 'https://cdn/render/x', 'photo')).toBe('vault-x.jpg');
    expect(savedName('x', 'https://cdn/render/x', 'video')).toBe('vault-x.mp4');
  });
});
