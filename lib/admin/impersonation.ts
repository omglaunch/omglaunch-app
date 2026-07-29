import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const IMPERSONATION_COOKIE = 'is_impersonating';
const IMPERSONATION_DATA_COOKIE = 'impersonation_data';

function getImpersonationSecret(): string {
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.ADMIN_ENCRYPTION_KEY?.trim() ||
    'dev-only-insecure-impersonation-secret'
  );
}

export interface ImpersonationState {
  adminId: string;
  targetUserId: string;
  targetEmail: string;
}

function signPayload(payload: string): string {
  return createHmac('sha256', getImpersonationSecret()).update(payload).digest('hex');
}

export async function setImpersonation(state: ImpersonationState): Promise<void> {
  const payload = JSON.stringify(state);
  const signature = signPayload(payload);
  const encoded = Buffer.from(`${payload}:${signature}`).toString('base64');

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 4, // 4 hours
    path: '/',
  };

  cookies().set(IMPERSONATION_COOKIE, 'true', cookieOptions);
  cookies().set(IMPERSONATION_DATA_COOKIE, encoded, cookieOptions);
}

export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const flag = cookies().get(IMPERSONATION_COOKIE)?.value;
  const data = cookies().get(IMPERSONATION_DATA_COOKIE)?.value;

  if (flag !== 'true' || !data) return null;

  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const signature = decoded.slice(lastColon + 1);
    const expected = signPayload(payload);

    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    return JSON.parse(payload) as ImpersonationState;
  } catch {
    return null;
  }
}

export async function isImpersonating(): Promise<boolean> {
  return (await getImpersonationState()) !== null;
}

export async function clearImpersonation(): Promise<void> {
  cookies().delete(IMPERSONATION_COOKIE);
  cookies().delete(IMPERSONATION_DATA_COOKIE);
}

export async function getEffectiveWorkspaceId(fallbackUserId: string): Promise<string> {
  const impersonation = await getImpersonationState();
  if (impersonation) {
    return impersonation.targetUserId;
  }
  return fallbackUserId;
}

export async function assertNotImpersonatingForGeneration(): Promise<void> {
  if (await isImpersonating()) {
    throw new Error('GENERATION_BLOCKED_WHILE_IMPERSONATING');
  }
}
