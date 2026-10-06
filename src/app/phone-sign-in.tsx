import { PhoneSignIn } from '@/features/auth/phone-sign-in';

/**
 * Signing in by text from the welcome screen: the number, then the code.
 * Full screen over the welcome screen (see src/app/_layout.tsx), which takes
 * over again once the code works.
 */
export default function PhoneSignInScreen() {
  return <PhoneSignIn />;
}
