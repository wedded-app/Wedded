import { useLocalSearchParams } from 'expo-router';

import { SignInFlow } from '@/features/auth/sign-in-flow';

/**
 * Presented as a modal over the tabs (see src/app/_layout.tsx). With no
 * parameters it starts on the choice of Apple, Google, phone or email;
 * `?method=phone` or `?method=email` opens straight on that one,
 * `?mode=edit` edits About you, and `?as=business` (List your business)
 * makes a new account a business without asking what it came for.
 */
export default function SignInScreen() {
  const { mode, method, as } = useLocalSearchParams<{
    mode?: string;
    method?: string;
    as?: string;
  }>();
  return (
    <SignInFlow
      mode={mode === 'edit' ? 'edit' : 'signIn'}
      method={method === 'phone' || method === 'email' ? method : undefined}
      joinAs={as === 'business' ? 'business' : undefined}
    />
  );
}
