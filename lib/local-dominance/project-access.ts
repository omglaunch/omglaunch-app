import { getPrisma } from '@/lib/prisma';
import {
  assertProjectAccess,
  assertProjectWriteAccess,
  requireAccessibleProjectId,
} from '@/lib/projects/team-access';
import { requireWorkspaceId } from '@/lib/projects/tenant-scope';

export class LocalAuditAccessError extends Error {
  constructor(message = 'Audit not found or access denied') {
    super(message);
    this.name = 'LocalAuditAccessError';
  }
}

/** Load a geogrid audit after workspace + viewer project checks (read). */
export async function requireAccessibleLocalAudit(auditId: string) {
  const workspaceId = await requireWorkspaceId();
  const audit = await getPrisma().localAuditHistory.findFirst({
    where: { id: auditId, workspaceId },
  });

  if (!audit) {
    throw new LocalAuditAccessError();
  }

  await assertProjectAccess(audit.projectId);
  return audit;
}

/** Load a geogrid audit with write access (delete). */
export async function requireAccessibleLocalAuditWrite(auditId: string) {
  const audit = await requireAccessibleLocalAudit(auditId);
  await assertProjectWriteAccess(audit.projectId);
  return audit;
}

/** Resolve project scope for local dominance list/run APIs. */
export async function requireLocalDominanceProjectId(
  projectId: string | null | undefined
): Promise<string> {
  return requireAccessibleProjectId(projectId);
}

export async function requireLocalDominanceProjectWriteId(
  projectId: string | null | undefined
): Promise<string> {
  const id = await requireAccessibleProjectId(projectId);
  await assertProjectWriteAccess(id);
  return id;
}
