import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const AVATAR_PUBLIC_DIR = '/uploads/avatars';

export function getAvatarRelativePath(userId: string): string {
  return `${AVATAR_PUBLIC_DIR}/${userId}.webp`;
}

export function getAvatarAbsolutePath(userId: string): string {
  return path.join(process.cwd(), 'public', 'uploads', 'avatars', `${userId}.webp`);
}

export function buildAvatarPublicUrl(userId: string, cacheBust?: number): string {
  const base = getAvatarRelativePath(userId);
  return cacheBust ? `${base}?v=${cacheBust}` : base;
}

export function isManagedAvatarUrl(image: string | null | undefined): boolean {
  if (!image) return false;
  return image.startsWith(`${AVATAR_PUBLIC_DIR}/`);
}

export async function ensureAvatarDirectory(): Promise<void> {
  await mkdir(path.join(process.cwd(), 'public', 'uploads', 'avatars'), { recursive: true });
}

export async function saveUserAvatar(userId: string, file: File): Promise<string> {
  if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WebP image.');
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Image must be 2MB or smaller.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await sharp(buffer)
    .rotate()
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer();

  await ensureAvatarDirectory();
  await writeFile(getAvatarAbsolutePath(userId), processed);

  return buildAvatarPublicUrl(userId, Date.now());
}

export async function deleteUserAvatar(userId: string): Promise<void> {
  try {
    await unlink(getAvatarAbsolutePath(userId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
