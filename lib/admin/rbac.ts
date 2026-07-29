import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export type PlatformRole = 'USER' | 'SUPPORT' | 'ADMIN' | 'SUPER_ADMIN';

export const ADMIN_ROLES: PlatformRole[] = ['ADMIN', 'SUPER_ADMIN'];
export const SUPER_ADMIN_ROLES: PlatformRole[] = ['SUPER_ADMIN'];

export class AdminAccessDeniedError extends Error {
  constructor(message = 'Admin access denied') {
    super(message);
    this.name = 'AdminAccessDeniedError';
  }
}

export function isAdminRole(role: string): role is 'ADMIN' | 'SUPER_ADMIN' {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdminRole(role: string): role is 'SUPER_ADMIN' {
  return role === 'SUPER_ADMIN';
}

export async function getAdminUser() {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user?.isActive || !isAdminRole(user.role)) {
    return null;
  }

  return user;
}

export async function requireAdminAccess(): Promise<{
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
}> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new AdminAccessDeniedError();
  }
  return admin as { id: string; email: string; name: string; role: PlatformRole };
}

export async function requireSuperAdminAccess() {
  const admin = await requireAdminAccess();
  if (!isSuperAdminRole(admin.role)) {
    throw new AdminAccessDeniedError('Super admin access required');
  }
  return admin;
}

export async function guardAdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/dashboard');
  }
  return admin;
}
