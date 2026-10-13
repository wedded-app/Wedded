import { chatUrlOf, enablePush, forgetThisPhone, pushStatus, syncPushToken } from './push';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockSettings = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  StorageKeys: { pushToken: 'push.token' },
  readSetting: (key: string) => mockSettings.get(key) ?? null,
  writeSetting: async (key: string, value: string) => void mockSettings.set(key, value),
}));

const mockDevice = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone' },
  default: {
    executionEnvironment: 'storeClient',
    expoConfig: { extra: { eas: { projectId: 'p1' } } },
  },
}));

const mockPermissions = jest.fn();
const mockRequest = jest.fn();
const mockToken = jest.fn();
jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: () => mockPermissions(),
  requestPermissionsAsync: () => mockRequest(),
  getExpoPushTokenAsync: (options: unknown) => mockToken(options),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  useLastNotificationResponse: () => null,
}));

const granted = { granted: true, canAskAgain: true, ios: { status: 2 } };
const undetermined = { granted: false, canAskAgain: true, ios: { status: 0 } };
const denied = { granted: false, canAskAgain: false, ios: { status: 1 } };

beforeEach(() => {
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockPermissions.mockReset();
  mockRequest.mockReset();
  mockToken.mockReset().mockResolvedValue({ data: 'ExponentPushToken[abc123abc123]' });
  mockSettings.clear();
  mockDevice.isDevice = true;
});

describe('pushStatus', () => {
  it('reads the permission without asking', async () => {
    mockPermissions.mockResolvedValue(undetermined);
    await expect(pushStatus()).resolves.toBe('undetermined');
    mockPermissions.mockResolvedValue(denied);
    await expect(pushStatus()).resolves.toBe('denied');
    mockPermissions.mockResolvedValue({ ...denied, ios: { status: 3 } });
    await expect(pushStatus()).resolves.toBe('granted');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('is unavailable on a simulator', async () => {
    mockDevice.isDevice = false;
    await expect(pushStatus()).resolves.toBe('unavailable');
  });
});

describe('enablePush', () => {
  it('asks once, then registers this phone with the account', async () => {
    mockPermissions.mockResolvedValue(undetermined);
    mockRequest.mockResolvedValue(granted);
    await expect(enablePush()).resolves.toBe('enabled');
    expect(mockToken).toHaveBeenCalledWith({ projectId: 'p1' });
    expect(mockRpc).toHaveBeenCalledWith('register_push_token', {
      p_token: 'ExponentPushToken[abc123abc123]',
      p_platform: 'ios',
    });
    expect(mockSettings.get('push.token')).toBe('ExponentPushToken[abc123abc123]');
  });

  it('never asks again after a no', async () => {
    mockPermissions.mockResolvedValue(denied);
    await expect(enablePush()).resolves.toBe('denied');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reports a failure when the token cannot be fetched', async () => {
    mockPermissions.mockResolvedValue(granted);
    mockToken.mockRejectedValue(new Error('offline'));
    await expect(enablePush()).resolves.toBe('failed');
  });
});

describe('syncPushToken', () => {
  it('registers quietly only when already allowed', async () => {
    mockPermissions.mockResolvedValue(undetermined);
    await syncPushToken();
    expect(mockRpc).not.toHaveBeenCalled();
    mockPermissions.mockResolvedValue(granted);
    await syncPushToken();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe('forgetThisPhone', () => {
  it('forgets the saved token, and does nothing without one', async () => {
    await forgetThisPhone();
    expect(mockRpc).not.toHaveBeenCalled();
    mockSettings.set('push.token', 'ExponentPushToken[abc123abc123]');
    await forgetThisPhone();
    expect(mockRpc).toHaveBeenCalledWith('unregister_push_token', {
      p_token: 'ExponentPushToken[abc123abc123]',
    });
    expect(mockSettings.get('push.token')).toBe('');
  });
});

describe('chatUrlOf', () => {
  const id = '6f1c0b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
  it('opens only a chat', () => {
    expect(chatUrlOf({ url: `/chat/${id}` })).toBe(`/chat/${id}`);
    expect(chatUrlOf({ conversationId: id })).toBe(`/chat/${id}`);
    expect(chatUrlOf({ url: 'https://evil.example' })).toBeNull();
    expect(chatUrlOf({ url: '/settings' })).toBeNull();
    expect(chatUrlOf(null)).toBeNull();
  });
});
