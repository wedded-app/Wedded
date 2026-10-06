import { formatPhoneDigits, nextPhoneDigits, phoneToE164 } from './phone-entry';

describe('formatPhoneDigits', () => {
  it('spaces US and Canadian numbers as they grow', () => {
    expect(formatPhoneDigits('', '1')).toBe('');
    expect(formatPhoneDigits('91', '1')).toBe('91');
    expect(formatPhoneDigits('9165', '1')).toBe('916 5');
    expect(formatPhoneDigits('9165550100', '1')).toBe('916 555 0100');
  });

  it('leaves other countries as typed', () => {
    expect(formatPhoneDigits('9876543210', '91')).toBe('9876543210');
  });
});

describe('nextPhoneDigits', () => {
  it('keeps only the digits', () => {
    expect(nextPhoneDigits('', '916-555', '1')).toBe('916555');
  });

  it('deletes a digit when only a space was deleted', () => {
    // "916 5" with its space backspaced reads "9165": the same digits, shorter.
    expect(nextPhoneDigits('9165', '9165', '1')).toBe('916');
    // Backspacing the 5 leaves "916 ".
    expect(nextPhoneDigits('9165', '916 ', '1')).toBe('916');
    // Typing keeps going.
    expect(nextPhoneDigits('9165', '916 55', '1')).toBe('91655');
  });

  it('drops the leading 1 from an autofilled US number', () => {
    expect(nextPhoneDigits('', '+1 (916) 555-0100', '1')).toBe('9165550100');
  });

  it('stops at the longest number for the country', () => {
    expect(nextPhoneDigits('', '91655501009', '1')).toBe('9165550100');
    expect(nextPhoneDigits('', '1234567890123456', '91')).toBe('1234567890123');
  });

  it('reads Gurmukhi digits', () => {
    expect(nextPhoneDigits('', '੯੧੬', '1')).toBe('916');
  });
});

describe('phoneToE164', () => {
  it('turns a whole US number into E.164', () => {
    expect(phoneToE164('9165550100', '1')).toBe('+19165550100');
  });

  it('is null until the number is whole and real-looking', () => {
    expect(phoneToE164('', '1')).toBeNull();
    expect(phoneToE164('916555', '1')).toBeNull();
    expect(phoneToE164('1165550100', '1')).toBeNull();
  });

  it('puts the country code in front of other numbers', () => {
    expect(phoneToE164('9876543210', '91')).toBe('+919876543210');
    expect(phoneToE164('12', '44')).toBeNull();
  });
});
