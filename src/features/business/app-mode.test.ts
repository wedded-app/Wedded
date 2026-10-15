import { openingMode } from './app-mode';

jest.mock('@/data/chat', () => ({}));
jest.mock('@/data/wedding', () => ({}));
jest.mock('@/features/auth/session', () => ({}));
jest.mock('@/lib/storage', () => ({ StorageKeys: {} }));

describe('openingMode', () => {
  it('keeps families on the planning side', () => {
    expect(openingMode(null, false, true)).toBe('planning');
    expect(openingMode('business', false, false)).toBe('planning');
  });

  it('opens a business with no wedding of its own in business mode', () => {
    expect(openingMode(null, true, false)).toBe('business');
  });

  it('opens a business that also plans a wedding on the planning side', () => {
    expect(openingMode(null, true, true)).toBe('planning');
  });

  it('remembers the side they last chose', () => {
    expect(openingMode('business', true, true)).toBe('business');
    expect(openingMode('planning', true, false)).toBe('planning');
  });
});
