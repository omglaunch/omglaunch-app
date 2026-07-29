export const HUB_SPOKE_BULK_IMPORT_KEY = 'hub-spoke-bulk-import';

export type HubSpokeBulkImportSpoke = {
  targetKeyword: string;
  title: string;
};

export function storeHubSpokeBulkImport(spokes: HubSpokeBulkImportSpoke[]): void {
  sessionStorage.setItem(HUB_SPOKE_BULK_IMPORT_KEY, JSON.stringify(spokes));
}

export function consumeHubSpokeBulkImport(): HubSpokeBulkImportSpoke[] | null {
  const raw = sessionStorage.getItem(HUB_SPOKE_BULK_IMPORT_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(HUB_SPOKE_BULK_IMPORT_KEY);

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(
      (item): item is HubSpokeBulkImportSpoke =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as HubSpokeBulkImportSpoke).targetKeyword === 'string' &&
        typeof (item as HubSpokeBulkImportSpoke).title === 'string'
    );
  } catch {
    return null;
  }
}
