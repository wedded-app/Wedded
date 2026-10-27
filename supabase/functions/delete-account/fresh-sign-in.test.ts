// In the function's folder: deno test --allow-env (CI runs it).
import { signedInRecently } from './fresh-sign-in.ts';

const now = 1_800_000_000;

function expect(actual: boolean, expected: boolean, what: string) {
  if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
}

Deno.test('a fresh email or text code counts', () => {
  expect(signedInRecently([{ method: 'otp', timestamp: now - 60 }], now), true, 'otp');
});

Deno.test('signing in again with Apple or Google counts', () => {
  expect(signedInRecently([{ method: 'oauth', timestamp: now - 599 }], now), true, 'oauth');
});

Deno.test('an old sign-in, or a refreshed token, does not', () => {
  expect(signedInRecently([{ method: 'otp', timestamp: now - 601 }], now), false, 'old otp');
  expect(
    signedInRecently(
      [
        { method: 'token_refresh', timestamp: now - 5 },
        { method: 'oauth', timestamp: now - 3600 },
      ],
      now,
    ),
    false,
    'refresh',
  );
});

Deno.test('other methods and broken claims do not', () => {
  expect(signedInRecently([{ method: 'password', timestamp: now }], now), false, 'password');
  expect(signedInRecently([{ method: 'anonymous', timestamp: now }], now), false, 'anonymous');
  expect(signedInRecently([{ method: 'otp' }], now), false, 'no time');
  expect(signedInRecently([{ method: 'otp', timestamp: now + 3600 }], now), false, 'future');
  expect(signedInRecently([{ method: 'otp', timestamp: now + 5 }], now), true, 'clock skew');
  expect(signedInRecently(undefined, now), false, 'no amr');
});
