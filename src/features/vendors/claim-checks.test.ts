import { maskedPhone } from './claim-checks';

describe('maskedPhone', () => {
  it('shows only the last two digits', () => {
    expect(maskedPhone('+15305550101')).toBe('(•••) •••-••01');
  });

  it('is null without a phone', () => {
    expect(maskedPhone(null)).toBeNull();
    expect(maskedPhone('')).toBeNull();
  });
});
