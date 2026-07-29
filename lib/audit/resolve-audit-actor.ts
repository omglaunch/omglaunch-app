import type { AuditActor } from '@/lib/audit/brand-manifest-audit';
import { SYSTEM_AUDIT_ACTOR } from '@/lib/audit/brand-manifest-audit';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';

export async function resolveAuditActorFromSession(): Promise<AuditActor> {
  const session = await getAuthenticatedSession();
  if (!session?.user?.email) {
    return SYSTEM_AUDIT_ACTOR;
  }

  return {
    actorName: session.user.name?.trim() || session.user.email,
    actorEmail: session.user.email,
  };
}
