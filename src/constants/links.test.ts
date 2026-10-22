import { shareLink } from './links';

const mockManifest: { metadata?: object } = {};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get manifest2() {
      return mockManifest;
    },
  },
}));
jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) =>
    `exp://u.expo.dev/project/--${path}${options?.queryParams ? `?${new URLSearchParams(options.queryParams)}` : ''}`,
}));

describe('shareLink', () => {
  it('keeps the published update channel, so Expo Go can open the link', () => {
    mockManifest.metadata = { branchName: 'demo' };
    expect(shareLink('/join/abc')).toBe('exp://u.expo.dev/project/--/join/abc?channel-name=demo');
  });

  it('adds nothing on a development server', () => {
    mockManifest.metadata = {};
    expect(shareLink('/rsvp/abc')).toBe('exp://u.expo.dev/project/--/rsvp/abc');
  });

  it('puts a guest token alongside the channel', () => {
    mockManifest.metadata = { branchName: 'demo' };
    expect(shareLink('/w/asha-ravi', { g: 'tok' })).toBe(
      'exp://u.expo.dev/project/--/w/asha-ravi?g=tok&channel-name=demo',
    );
  });
});
