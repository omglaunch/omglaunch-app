import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const SUDO_COOKIE = 'admin_sudo_verified';
const SUDO_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getSudoSecret(): string {
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.ADMIN_ENCRYPTION_KEY?.trim() ||
    'dev-only-insecure-sudo-secret'
  );
}

function signSudoPayload(adminId: string, timestamp: number): string {
  return createHmac('sha256', getSudoSecret())
    .update(`${adminId}:${timestamp}`)
    .digest('hex');
}

export async function setSudoVerified(adminId: string): Promise<void> {
  const timestamp = Date.now();
  const signature = signSudoPayload(adminId, timestamp);
  const value = `${adminId}:${timestamp}:${signature}`;

  cookies().set(SUDO_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SUDO_DURATION_MS / 1000,
    path: '/',
  });
}

export async function isSudoVerified(adminId: string): Promise<boolean> {
  const cookie = cookies().get(SUDO_COOKIE)?.value;
  if (!cookie) return false;

  const parts = cookie.split(':');
  if (parts.length !== 3) return false;

  const [cookieAdminId, timestampStr, signature] = parts;
  if (cookieAdminId !== adminId) return false;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > SUDO_DURATION_MS) return false;

  const expected = signSudoPayload(adminId, timestamp);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function requireSudoMode(adminId: string): Promise<void> {
  const verified = await isSudoVerified(adminId);
  if (!verified) {
    throw new Error('SUDO_REQUIRED');
  }
}

export async function clearSudoMode(): Promise<void> {
  cookies().delete(SUDO_COOKIE);
}
