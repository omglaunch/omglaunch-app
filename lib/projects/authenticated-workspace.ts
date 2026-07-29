import { headers } from 'next/headers';
import { auth, type AuthSession } from '@/lib/auth';
import { UnauthenticatedError } from '@/lib/projects/auth-errors';
import { getEffectiveWorkspaceId } from '@/lib/admin/impersonation';

export { UnauthenticatedError, isUnauthenticatedError } from '@/lib/projects/auth-errors';

/**
 * Resolves the authenticated tenant workspace for server actions and API routes.
 * MVP: 1 user = 1 workspace — uses the signed-in user's id as workspaceId.
 * When admin impersonation is active, returns the impersonated user's id.
 */
export async function getAuthenticatedSession(): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getAuthenticatedWorkspaceId(): Promise<string> {
  const session = await getAuthenticatedSession();

  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }

  return getEffectiveWorkspaceId(session.user.id);
}
