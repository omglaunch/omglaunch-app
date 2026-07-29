import type { SiloProjectDto } from '@/lib/silo-builder/types';

export type SiloProjectExportPayload = SiloProjectDto & {
  exportedAt: string;
  exportVersion: 1;
};

export function buildSiloProjectExportPayload(
  project: SiloProjectDto
): SiloProjectExportPayload {
  return {
    ...project,
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
  };
}

export function serializeSiloProjectJson(project: SiloProjectDto): string {
  return JSON.stringify(buildSiloProjectExportPayload(project), null, 2);
}

export function createSiloProjectJsonBlob(project: SiloProjectDto): Blob {
  return new Blob([serializeSiloProjectJson(project)], {
    type: 'application/json;charset=utf-8',
  });
}
