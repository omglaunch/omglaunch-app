import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEYLEN = 64;

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySharePassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) {
    return false;
  }

  try {
    const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function buildShareUnlockCookieValue(shareToken: string, passwordHash: string): string {
  return createHash('sha256')
    .update(`${shareToken}:${passwordHash}`)
    .digest('hex');
}

export function shareUnlockCookieName(shareToken: string): string {
  return `share_unlock_${shareToken}`;
}
