import {
  appleFullName,
  authErrorKey,
  authParamsFromUrl,
  enabledProviders,
  nameFromMetadata,
  phoneFromAuth,
  reauthMethod,
} from './auth-helpers';

describe('authParamsFromUrl', () => {
  it('reads implicit-flow tokens from the fragment of an Expo Go address', () => {
    const url =
      'exp://192.168.1.5:8081/--/auth-callback#access_token=abc.def.ghi&expires_in=3600' +
      '&refresh_token=r3fr35h&token_type=bearer&type=signup';
    expect(authParamsFromUrl(url)).toEqual({
      accessToken: 'abc.def.ghi',
      refreshToken: 'r3fr35h',
      code: null,
      error: null,
      errorCode: null,
      errorDescription: null,
    });
  });

  it('reads a PKCE code from the query of an app-scheme address', () => {
    const params = authParamsFromUrl('weddingapp://auth-callback?code=9f8e7d&sb_flow_id=1');
    expect(params.code).toBe('9f8e7d');
    expect(params.accessToken).toBeNull();
  });

  it('reads both the query and the fragment, the fragment winning', () => {
    const params = authParamsFromUrl(
      'http://localhost:8081/auth-callback?next=delete-account&code=old#access_token=new',
    );
    expect(params.code).toBe('old');
    expect(params.accessToken).toBe('new');
  });

  it('reads and decodes an error, e.g. when they cancel at Google', () => {
    const params = authParamsFromUrl(
      'exp://127.0.0.1:8081/--/auth-callback#error=access_denied&error_code=provider_error' +
        '&error_description=The+user+denied%20access',
    );
    expect(params.error).toBe('access_denied');
    expect(params.errorCode).toBe('provider_error');
    expect(params.errorDescription).toBe('The user denied access');
    expect(params.accessToken).toBeNull();
  });

  it('gives nulls for an address without parameters or with broken ones', () => {
    expect(authParamsFromUrl('weddingapp://auth-callback')).toEqual({
      accessToken: null,
      refreshToken: null,
      code: null,
      error: null,
      errorCode: null,
      errorDescription: null,
    });
    expect(authParamsFromUrl('weddingapp://x#access_token=%E0%A4%A&=&flag').accessToken).toBe(
      '%E0%A4%A',
    );
  });
});

describe('enabledProviders', () => {
  it('reads the external flags from /auth/v1/settings', () => {
    expect(
      enabledProviders({
        external: { apple: true, google: false, phone: true, email: true, github: false },
        disable_signup: false,
      }),
    ).toEqual({ apple: true, google: false, phone: true, email: true });
  });

  it('counts anything unreadable as off', () => {
    const off = { apple: false, google: false, phone: false, email: false };
    expect(enabledProviders(null)).toEqual(off);
    expect(enabledProviders({ message: 'Invalid API key' })).toEqual(off);
    expect(enabledProviders({ external: { email: 'yes' } })).toEqual(off);
  });
});

describe('authErrorKey', () => {
  it('explains a failed bot check', () => {
    expect(authErrorKey({ code: 'captcha_failed', status: 400 })).toBe('signIn.errors.captcha');
  });

  it('says to wait for either kind of rate limit', () => {
    expect(authErrorKey({ code: 'over_sms_send_rate_limit', status: 429 }, 'phone')).toBe(
      'signIn.errors.tooMany',
    );
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('signIn.errors.tooMany');
    expect(authErrorKey({ status: 429 })).toBe('signIn.errors.tooMany');
  });

  it('points a wrong code at the email or the text message', () => {
    expect(authErrorKey({ code: 'otp_expired' }, 'email')).toBe('signIn.errors.codeWrong');
    expect(authErrorKey({ code: 'otp_expired' }, 'phone')).toBe('signIn.errors.codeWrongPhone');
  });

  it('explains text messages that could not be sent', () => {
    expect(authErrorKey({ code: 'sms_send_failed' }, 'phone')).toBe('signIn.errors.smsFailed');
    expect(authErrorKey({ code: 'phone_provider_disabled' }, 'phone')).toBe(
      'signIn.errors.phoneOff',
    );
    expect(authErrorKey({ code: 'validation_failed' }, 'phone')).toBe(
      'aboutYou.errors.phoneInvalid',
    );
  });

  it('spots network trouble and falls back to a generic message', () => {
    expect(authErrorKey({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      'signIn.errors.network',
    );
    expect(authErrorKey({ code: 'unexpected_failure', status: 500 })).toBe('signIn.errors.generic');
  });
});

describe('names and phone numbers from the account', () => {
  it('takes the name Google shares', () => {
    expect(nameFromMetadata({ full_name: '  Harjit   Kaur ', name: 'H K' })).toBe('Harjit Kaur');
    expect(nameFromMetadata({ name: 'Gurpreet Singh' })).toBe('Gurpreet Singh');
    expect(nameFromMetadata({ email: 'x@example.com' })).toBeNull();
    expect(nameFromMetadata(undefined)).toBeNull();
  });

  it('joins the name Apple shares the first time', () => {
    expect(appleFullName({ givenName: 'Harjit', middleName: null, familyName: 'Kaur' })).toBe(
      'Harjit Kaur',
    );
    expect(appleFullName({ givenName: ' ', familyName: null, nickname: 'Harry' })).toBe('Harry');
    expect(appleFullName({ givenName: null, familyName: null })).toBeNull();
    expect(appleFullName(null)).toBeNull();
  });

  it('puts the + back on the phone Supabase stores', () => {
    expect(phoneFromAuth('15305550100')).toBe('+15305550100');
    expect(phoneFromAuth('+919876543210')).toBe('+919876543210');
    expect(phoneFromAuth('')).toBeNull();
    expect(phoneFromAuth(undefined)).toBeNull();
  });
});

describe('reauthMethod', () => {
  it('uses the way they signed up', () => {
    expect(
      reauthMethod({ email: 'h@example.com', app_metadata: { providers: ['email'] } }, 'ios'),
    ).toBe('email');
    expect(
      reauthMethod({ email: '', phone: '15305550100', app_metadata: { provider: 'phone' } }, 'ios'),
    ).toBe('phone');
    expect(
      reauthMethod(
        { email: 'x@privaterelay.appleid.com', app_metadata: { providers: ['apple'] } },
        'ios',
      ),
    ).toBe('apple');
    expect(
      reauthMethod({ email: 'h@gmail.com', app_metadata: { providers: ['google'] } }, 'android'),
    ).toBe('google');
  });

  it('prefers a code when a Google account was linked to an email one', () => {
    expect(
      reauthMethod(
        { email: 'h@gmail.com', app_metadata: { providers: ['email', 'google'] } },
        'web',
      ),
    ).toBe('email');
  });

  it('falls back to an email code for Apple away from an iPhone, or gives up', () => {
    expect(
      reauthMethod(
        { email: 'x@privaterelay.appleid.com', app_metadata: { providers: ['apple'] } },
        'android',
      ),
    ).toBe('email');
    expect(reauthMethod({ email: '', app_metadata: { providers: ['apple'] } }, 'web')).toBeNull();
  });
});
