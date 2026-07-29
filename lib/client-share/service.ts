import { cookies } from 'next/headers';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import { assertOwnedProject } from '@/lib/projects/tenant-scope';
import { assertProjectWriteAccess } from '@/lib/projects/team-access';
import { getPrisma } from '@/lib/prisma';
import {
  buildClientShareSnapshot,
  defaultShareTitle,
} from '@/lib/client-share/build-snapshots';
import {
  buildShareUnlockCookieValue,
  hashSharePassword,
  shareUnlockCookieName,
  verifySharePassword,
} from '@/lib/client-share/password';
import type { ClientShareReportType } from '@/lib/client-share/types';
import { isClientShareReportType } from '@/lib/client-share/types';
import { buildClientShareUrl } from '@/lib/client-share/urls';

export class ClientShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientShareError';
  }
}

export type ResolvedClientShare = {
  id: string;
  shareToken: string;
  reportType: ClientShareReportType;
  title: string;
  snapshot: unknown;
  passwordProtected: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function parseExpiresInDays(value: unknown): number | null {
  if (value == null || value === '') return null;
  const days = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return Math.min(days, 365);
}

function isShareExpired(expiresAt: Date | null): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

function isShareRevoked(revokedAt: Date | null): boolean {
  return Boolean(revokedAt);
}

export async function createClientShareLink(input: {
  workspaceId: string;
  projectId: string;
  reportType: string;
  sourceId?: string | number | null;
  expiresInDays?: number | null;
  password?: string | null;
}): Promise<{ id: string; shareToken: string; shareUrl: string; expiresAt: string | null }> {
  if (!isClientShareReportType(input.reportType)) {
    throw new ClientShareError('Invalid report type.');
  }

  await assertProjectWriteAccess(input.projectId);
  await assertOwnedProject(input.projectId, input.workspaceId);

  const snapshot = await buildClientShareSnapshot({
    reportType: input.reportType,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    sourceId: input.sourceId,
  });

  const title =
    input.reportType === 'page_audit' && snapshot && typeof snapshot === 'object' && 'audit' in snapshot
      ? defaultShareTitle(
          input.reportType,
          (snapshot as { meta: Parameters<typeof defaultShareTitle>[1] }).meta,
          (snapshot as { audit: { targetKeyword: string } }).audit.targetKeyword
        )
      : defaultShareTitle(
          input.reportType,
          (snapshot as { meta: Parameters<typeof defaultShareTitle>[1] }).meta
        );

  const expiresInDays = parseExpiresInDays(input.expiresInDays);
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const trimmedPassword = input.password?.trim() ?? '';
  if (trimmedPassword && trimmedPassword.length < 4) {
    throw new ClientShareError('Password must be at least 4 characters.');
  }

  const session = await getAuthenticatedSession();

  const record = await getPrisma().clientShareLink.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      reportType: input.reportType,
      title,
      snapshot,
      passwordHash: trimmedPassword ? hashSharePassword(trimmedPassword) : null,
      expiresAt,
      createdByUserId: session?.user?.id ?? null,
    },
  });

  return {
    id: record.id,
    shareToken: record.shareToken,
    shareUrl: buildClientShareUrl(record.shareToken),
    expiresAt: record.expiresAt?.toISOString() ?? null,
  };
}

export async function revokeClientShareLink(input: {
  workspaceId: string;
  shareId: string;
  projectId: string;
}): Promise<void> {
  await assertProjectWriteAccess(input.projectId);
  await assertOwnedProject(input.projectId, input.workspaceId);

  const result = await getPrisma().clientShareLink.updateMany({
    where: {
      id: input.shareId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    throw new ClientShareError('Share link not found or already revoked.');
  }
}

async function loadShareRecord(shareToken: string) {
  return getPrisma().clientShareLink.findUnique({
    where: { shareToken },
  });
}

export async function resolvePublicClientShare(
  shareToken: string
): Promise<
  | { status: 'ok'; share: ResolvedClientShare }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'password_required' }
> {
  const record = await loadShareRecord(shareToken.trim());
  if (!record) {
    return { status: 'not_found' };
  }

  if (isShareRevoked(record.revokedAt)) {
    return { status: 'revoked' };
  }

  if (isShareExpired(record.expiresAt)) {
    return { status: 'expired' };
  }

  if (record.passwordHash) {
    const cookieStore = await cookies();
    const expected = buildShareUnlockCookieValue(record.shareToken, record.passwordHash);
    const actual = cookieStore.get(shareUnlockCookieName(record.shareToken))?.value;
    if (actual !== expected) {
      return { status: 'password_required' };
    }
  }

  if (!isClientShareReportType(record.reportType)) {
    return { status: 'not_found' };
  }

  return {
    status: 'ok',
    share: {
      id: record.id,
      shareToken: record.shareToken,
      reportType: record.reportType,
      title: record.title,
      snapshot: record.snapshot,
      passwordProtected: Boolean(record.passwordHash),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      revokedAt: record.revokedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    },
  };
}

export async function unlockClientShareLink(
  shareToken: string,
  password: string
): Promise<{ cookieName: string; cookieValue: string; maxAge: number }> {
  const record = await loadShareRecord(shareToken.trim());
  if (!record || !record.passwordHash) {
    throw new ClientShareError('Share link not found.');
  }

  if (isShareRevoked(record.revokedAt) || isShareExpired(record.expiresAt)) {
    throw new ClientShareError('This share link is no longer available.');
  }

  if (!verifySharePassword(password, record.passwordHash)) {
    throw new ClientShareError('Incorrect password.');
  }

  const maxAge = record.expiresAt
    ? Math.max(60, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000))
    : 60 * 60 * 24 * 30;

  return {
    cookieName: shareUnlockCookieName(record.shareToken),
    cookieValue: buildShareUnlockCookieValue(record.shareToken, record.passwordHash),
    maxAge,
  };
}
