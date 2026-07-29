'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getSocialSignInErrorMessage,
  startGoogleSignIn,
} from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type LoginClientProps = {
  googleAuthEnabled: boolean;
};

export default function LoginClient({ googleAuthEnabled }: LoginClientProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (!googleAuthEnabled) {
      setError(
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.'
      );
      return;
    }

    setIsSigningIn(true);
    setError(null);

    try {
      const result = await startGoogleSignIn('/dashboard');
      const message = getSocialSignInErrorMessage(result);

      if (message) {
        setError(message);
        setIsSigningIn(false);
        return;
      }

      const url = result.data?.url;
      if (url && result.data?.redirect !== false) {
        window.location.assign(url);
        return;
      }

      setError('Unable to start Google sign-in. Please try again.');
      setIsSigningIn(false);
    } catch (signInError) {
      const message =
        signInError instanceof Error
          ? signInError.message
          : 'Unable to start Google sign-in.';
      setError(message);
      setIsSigningIn(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left pane — full width on mobile, half on desktop */}
      <div className="flex w-full flex-1 items-center justify-center bg-slate-50 px-4 py-12 sm:px-8 lg:w-1/2">
        <Card className="w-full max-w-md border-slate-200/80 shadow-lg shadow-slate-200/50">
          <CardHeader className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              OMG Launch
            </p>
            <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
              Welcome to the Engine
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Your enterprise command center for generative SEO, rank intelligence,
              and topical architecture.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-center gap-3 text-sm font-medium"
              onClick={() => void handleGoogleSignIn()}
              disabled={isSigningIn || !googleAuthEnabled}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to Google...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </Button>

            {!googleAuthEnabled ? (
              <p className="text-center text-sm text-amber-700" role="status">
                Google OAuth credentials are missing from the server environment.
              </p>
            ) : null}

            {error ? (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Right pane — hidden on mobile, half on desktop */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:3rem_3rem]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.12)_0%,transparent_70%)]"
        />

        {/* Topical map placeholder */}
        <div aria-hidden="true" className="relative z-10 w-full max-w-lg px-12">
          <svg
            viewBox="0 0 400 320"
            className="h-auto w-full opacity-30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="200" cy="160" r="8" fill="rgba(59,130,246,0.8)" />
            <circle cx="120" cy="80" r="5" fill="rgba(148,163,184,0.6)" />
            <circle cx="280" cy="80" r="5" fill="rgba(148,163,184,0.6)" />
            <circle cx="80" cy="200" r="5" fill="rgba(148,163,184,0.6)" />
            <circle cx="320" cy="200" r="5" fill="rgba(148,163,184,0.6)" />
            <circle cx="160" cy="260" r="4" fill="rgba(148,163,184,0.4)" />
            <circle cx="240" cy="260" r="4" fill="rgba(148,163,184,0.4)" />
            <circle cx="200" cy="40" r="4" fill="rgba(148,163,184,0.4)" />
            <line x1="200" y1="160" x2="120" y2="80" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            <line x1="200" y1="160" x2="280" y2="80" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            <line x1="200" y1="160" x2="80" y2="200" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            <line x1="200" y1="160" x2="320" y2="200" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
            <line x1="200" y1="160" x2="160" y2="260" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
            <line x1="200" y1="160" x2="240" y2="260" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
            <line x1="200" y1="160" x2="200" y2="40" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
            <line x1="120" y1="80" x2="280" y2="80" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
            <line x1="80" y1="200" x2="320" y2="200" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative z-10 max-w-md px-12 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400/80">
            The Generative SEO Ecosystem
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
            Scale Your Search Authority on Autopilot
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Stop guessing at semantic gaps. Deploy a unified engine to map your
            precise topical architecture, push highly-optimized AI content
            directly to your CMS, and watch your real-time rankings climb.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
