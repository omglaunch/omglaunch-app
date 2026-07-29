export type HubGroup = {
  hubTitle: string;
  hubKeyword: string;
  spokeTitles: string[];
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSpokeTitle(title: string, clusterTitles: string[]): string | null {
  const normalized = normalizeLabel(title);
  if (!normalized) {
    return null;
  }

  return (
    clusterTitles.find(clusterTitle => normalizeLabel(clusterTitle) === normalized) ??
    null
  );
}

export function normalizeHubGroups(
  value: unknown,
  clusterTitles: string[]
): HubGroup[] {
  if (!Array.isArray(value) || clusterTitles.length === 0) {
    return [];
  }

  const groups: HubGroup[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const candidate = item as Partial<HubGroup>;
    const hubTitle = candidate.hubTitle?.trim();
    const hubKeyword = candidate.hubKeyword?.trim();
    if (!hubTitle || !hubKeyword || !Array.isArray(candidate.spokeTitles)) {
      continue;
    }

    const spokeTitles = candidate.spokeTitles
      .map(title => (typeof title === 'string' ? resolveSpokeTitle(title, clusterTitles) : null))
      .filter((title): title is string => Boolean(title));

    const uniqueSpokeTitles = Array.from(new Set(spokeTitles));
    if (!uniqueSpokeTitles.length) {
      continue;
    }

    groups.push({
      hubTitle,
      hubKeyword,
      spokeTitles: uniqueSpokeTitles,
    });
  }

  return groups.slice(0, 5);
}

export function parseHubGroups(value: unknown): HubGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is HubGroup =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as HubGroup).hubTitle === 'string' &&
      typeof (item as HubGroup).hubKeyword === 'string' &&
      Array.isArray((item as HubGroup).spokeTitles) &&
      (item as HubGroup).spokeTitles.every(title => typeof title === 'string')
  );
}
