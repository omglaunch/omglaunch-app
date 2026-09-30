import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { prisma } from '@/lib/prisma';

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function readTrustedOrigins(): string[] {
  const origins = new Set<string>();

  const baseUrl = readEnv('BETTER_AUTH_URL');
  if (baseUrl) {
    try {
      origins.add(new URL(baseUrl).origin);
    } catch {
      // ignore invalid BETTER_AUTH_URL
    }
  }

  const publicAppUrl = readEnv('NEXT_PUBLIC_APP_URL');
  if (publicAppUrl) {
    try {
      origins.add(new URL(publicAppUrl).origin);
    } catch {
      // ignore invalid NEXT_PUBLIC_APP_URL
    }
  }

  const extra = readEnv('BETTER_AUTH_TRUSTED_ORIGINS');
  if (extra) {
    for (const origin of extra.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return Array.from(origins);
}

function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

const authSecret =
  readEnv('BETTER_AUTH_SECRET') ||
  (isNextProductionBuild()
    ? 'build-time-placeholder-not-used-at-runtime'
    : process.env.NODE_ENV === 'production'
      ? undefined
      : 'dev-only-insecure-secret');

if (!authSecret) {
  throw new Error('BETTER_AUTH_SECRET is not configured.');
}

const googleClientId = readEnv('GOOGLE_CLIENT_ID');
const googleClientSecret = readEnv('GOOGLE_CLIENT_SECRET');
const trustedOrigins = readTrustedOrigins();

export function isGoogleAuthConfigured(): boolean {
  return Boolean(googleClientId && googleClientSecret);
}

export const auth = betterAuth({
  secret: authSecret,
  baseURL: readEnv('BETTER_AUTH_URL') || 'http://localhost:3000',
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  socialProviders: isGoogleAuthConfigured()
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        },
      }
    : {},
});

export type AuthSession = typeof auth.$Infer.Session;
