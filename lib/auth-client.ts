import { createAuthClient } from 'better-auth/react';

/** Same-origin by default so ngrok/local both hit the current host's /api/auth. */
export const authClient = createAuthClient();

type SocialSignInResult = {
  data?: {
    url?: string;
    redirect?: boolean;
  } | null;
  error?: {
    message?: string;
    code?: string;
  } | null;
};

export function getSocialSignInErrorMessage(result: SocialSignInResult): string | null {
  if (result.error?.message) {
    if (result.error.code === 'PROVIDER_NOT_FOUND') {
      return 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.';
    }
    return result.error.message;
  }
  return null;
}

export async function startGoogleSignIn(callbackURL = '/dashboard'): Promise<SocialSignInResult> {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL,
  }) as Promise<SocialSignInResult>;
}
