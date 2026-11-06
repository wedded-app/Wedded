import {
  isValidEmail,
  normalizePhone,
  toLatinDigits,
  validateAboutYou,
} from './about-you-validation';

describe('normalizePhone', () => {
  it.each([
    ['5305550101', '+15305550101'],
    ['(530) 555-0101', '+15305550101'],
    ['530.555.0101', '+15305550101'],
    ['1 530 555 0101', '+15305550101'],
    ['+1 530 555 0101', '+15305550101'],
    ['+91 98765 43210', '+919876543210'],
    ['੫੩੦੫੫੫੦੧੦੧', '+15305550101'],
  ])('accepts %s', (typed, stored) => {
    expect(normalizePhone(typed)).toBe(stored);
  });

  it.each(['555 0101', '0305550101', '1305550101', '5301550101', '+12', 'call me'])(
    'refuses %s',
    (typed) => {
      expect(normalizePhone(typed)).toBeNull();
    },
  );
});

describe('toLatinDigits', () => {
  it('turns Gurmukhi digits into 0-9', () => {
    expect(toLatinDigits('੧੨੩ abc ੦')).toBe('123 abc 0');
  });
});

describe('isValidEmail', () => {
  it('accepts normal addresses and refuses broken ones', () => {
    expect(isValidEmail('harjit@example.com')).toBe(true);
    expect(isValidEmail('harjit@example')).toBe(false);
    expect(isValidEmail('harjit example.com')).toBe(false);
  });
});

describe('validateAboutYou', () => {
  const complete = {
    name: '  Harjit   Kaur ',
    city: ' Yuba City ',
    phone: '(530) 555-0101',
    email: ' Harjit@Example.COM ',
  };

  it('cleans up a complete form', () => {
    expect(validateAboutYou(complete)).toEqual({
      errors: {},
      values: {
        name: 'Harjit Kaur',
        city: 'Yuba City',
        phone: '+15305550101',
        email: 'harjit@example.com',
      },
    });
  });

  it('says what is missing or wrong, field by field', () => {
    const { errors, values } = validateAboutYou({
      name: ' ',
      city: '',
      phone: '555',
      email: 'nope',
    });
    expect(values).toBeNull();
    expect(errors).toEqual({
      name: 'nameRequired',
      phone: 'phoneInvalid',
      email: 'emailInvalid',
    });
  });

  it('needs only the name: the city and phone are asked when they first message a vendor', () => {
    expect(validateAboutYou({ name: 'Harjit', city: ' ', phone: '', email: '' })).toEqual({
      errors: {},
      values: { name: 'Harjit', city: null, phone: null, email: null },
    });
  });

  it('lets accounts without an email finish (phone, Apple or Google)', () => {
    expect(validateAboutYou({ ...complete, email: '  ' })).toEqual({
      errors: {},
      values: {
        name: 'Harjit Kaur',
        city: 'Yuba City',
        phone: '+15305550101',
        email: null,
      },
    });
  });

  it('still refuses a broken email when one is given', () => {
    expect(validateAboutYou({ ...complete, email: 'harjit@' }).errors).toEqual({
      email: 'emailInvalid',
    });
  });

  it('takes a number from a phone sign-in as the app shows it', () => {
    expect(validateAboutYou({ ...complete, phone: '(530) 555-0100' }).values?.phone).toBe(
      '+15305550100',
    );
  });
});
