import { getPrisma } from '@/lib/prisma';
import type { SiloProject } from '@prisma/client';

export class SiloAccessDeniedError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'SiloAccessDeniedError';
  }
}

export function isSiloAccessDeniedError(error: unknown): boolean {
  return error instanceof SiloAccessDeniedError;
}

export async function assertSiloProjectAccess(
  projectId: string,
  workspaceId: string
): Promise<SiloProject> {
  const prisma = getPrisma();
  const project = await prisma.siloProject.findFirst({
    where: { id: projectId, workspaceId },
  });

  if (!project) {
    throw new SiloAccessDeniedError('Project not found or access denied');
  }

  return project;
}

/** Only the user who created the silo project may delete it. */
export async function assertSiloProjectCreator(
  projectId: string,
  userId: string
): Promise<SiloProject> {
  const prisma = getPrisma();
  const project = await prisma.siloProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new SiloAccessDeniedError('Only the project creator can delete this silo');
  }

  return project;
}

/** @deprecated Use assertSiloProjectCreator for deletes or assertSiloProjectAccess for reads/writes. */
export async function assertSiloProjectOwner(
  projectId: string,
  userId: string
): Promise<SiloProject> {
  return assertSiloProjectCreator(projectId, userId);
}

export async function assertSiloNodeAccess(
  nodeId: string,
  workspaceId: string
): Promise<{ nodeId: string; projectId: string }> {
  const prisma = getPrisma();
  const node = await prisma.siloNode.findFirst({
    where: { id: nodeId },
    include: { project: { select: { workspaceId: true } } },
  });

  if (!node || node.project.workspaceId !== workspaceId) {
    throw new SiloAccessDeniedError('Node not found or access denied');
  }

  return { nodeId: node.id, projectId: node.projectId };
}

/** @deprecated Use assertSiloNodeAccess with workspaceId. */
export async function assertSiloNodeOwner(
  nodeId: string,
  userId: string
): Promise<{ nodeId: string; projectId: string }> {
  const prisma = getPrisma();
  const node = await prisma.siloNode.findFirst({
    where: { id: nodeId },
    include: { project: { select: { userId: true } } },
  });

  if (!node || node.project.userId !== userId) {
    throw new SiloAccessDeniedError('Node not found or access denied');
  }

  return { nodeId: node.id, projectId: node.projectId };
}
