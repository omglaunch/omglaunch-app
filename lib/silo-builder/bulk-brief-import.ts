export const SILO_BUILDER_BULK_IMPORT_KEY = 'silo-builder-bulk-import';

export type SiloBulkImportNode = {
  siloNodeId: string;
  siloProjectId: string;
  siloProjectTitle: string;
  targetKeyword: string;
  title: string;
  intent?: string | null;
};

export function storeSiloBuilderBulkImport(nodes: SiloBulkImportNode[]): void {
  sessionStorage.setItem(SILO_BUILDER_BULK_IMPORT_KEY, JSON.stringify(nodes));
}

export function consumeSiloBuilderBulkImport(): SiloBulkImportNode[] | null {
  const raw = sessionStorage.getItem(SILO_BUILDER_BULK_IMPORT_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(SILO_BUILDER_BULK_IMPORT_KEY);

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(
      (item): item is SiloBulkImportNode =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SiloBulkImportNode).siloNodeId === 'string' &&
        typeof (item as SiloBulkImportNode).siloProjectId === 'string' &&
        typeof (item as SiloBulkImportNode).siloProjectTitle === 'string' &&
        typeof (item as SiloBulkImportNode).targetKeyword === 'string' &&
        typeof (item as SiloBulkImportNode).title === 'string'
    );
  } catch {
    return null;
  }
}
