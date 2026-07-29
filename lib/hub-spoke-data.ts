export type HubSpokeMapSummary = {
  id: string;
  seedKeyword: string;
  location: string;
  createdAt: string;
};

export type SavedHubSpokeMap = HubSpokeMapSummary & {
  mapData: HubSpokeMap;
  updatedAt: string;
};

export type HubSpokePillar = {
  title: string;
  targetKeyword: string;
  summary: string;
  primaryCallToAction: string;
};

export type HubSpokeLateralLink = {
  spokeTitle: string;
  suggestedLateralAnchorText: string;
};

export type ClusterNodeStatus = 'Draft' | 'Generating' | 'Published';

export type HubSpokeCluster = {
  id?: string;
  title: string;
  targetKeyword: string;
  funnelStage: 'TOFU' | 'MOFU' | 'BOFU' | string;
  searchIntent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational' | string;
  anchorTextToPillar: string;
  lateralLinks: HubSpokeLateralLink[];
  semanticEntities: string[];
  summary: string;
  searchVolume?: number | null;
  keywordDifficulty?: number | null;
  status?: ClusterNodeStatus;
};

export type HubSpokeMap = {
  pillar: HubSpokePillar;
  clusters: HubSpokeCluster[];
};

function isLateralLink(value: unknown): value is HubSpokeLateralLink {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as HubSpokeLateralLink;
  return (
    typeof candidate.spokeTitle === 'string' &&
    candidate.spokeTitle.trim().length > 0 &&
    typeof candidate.suggestedLateralAnchorText === 'string' &&
    candidate.suggestedLateralAnchorText.trim().length > 0
  );
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeSemanticEntities(
  value: unknown,
  targetKeyword: string,
  title: string
): string[] {
  const entities = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
    : [];

  const unique = Array.from(new Set(entities));

  if (unique.length >= 3) {
    return unique.slice(0, 5);
  }

  const fallback = [
    ...unique,
    targetKeyword,
    title.split(':')[0]?.trim() || title,
    `${targetKeyword} guide`,
  ];

  return Array.from(new Set(fallback.filter(item => item.length > 0))).slice(0, 5);
}

function normalizeLateralLinks(
  value: unknown,
  clusterTitle: string,
  clusterTitles: string[]
): HubSpokeLateralLink[] {
  const validTitles = new Set(clusterTitles);
  const parsed = Array.isArray(value) ? value.filter(isLateralLink) : [];

  const normalized = parsed
    .filter(
      link =>
        link.spokeTitle !== clusterTitle &&
        validTitles.has(link.spokeTitle)
    )
    .slice(0, 2);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackTitle = clusterTitles.find(title => title !== clusterTitle);
  if (!fallbackTitle) {
    return [];
  }

  return [
    {
      spokeTitle: fallbackTitle,
      suggestedLateralAnchorText: `compare with our guide on ${fallbackTitle.toLowerCase()}`,
    },
  ];
}

/** Repairs common LLM shape issues before strict validation. */
export function normalizeHubSpokeMap(
  value: unknown,
  options?: { minClusters?: number; maxClusters?: number }
): HubSpokeMap | null {
  const minClusters = options?.minClusters ?? 8;
  const maxClusters = options?.maxClusters ?? 10;
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as HubSpokeMap;

  const pillarTitle = asNonEmptyString(candidate.pillar?.title);
  const pillarKeyword = asNonEmptyString(candidate.pillar?.targetKeyword);
  const pillarSummary = asNonEmptyString(candidate.pillar?.summary);
  const pillarCta = asNonEmptyString(candidate.pillar?.primaryCallToAction);

  if (!pillarTitle || !pillarKeyword || !pillarSummary || !pillarCta) {
    return null;
  }

  if (!Array.isArray(candidate.clusters)) {
    return null;
  }

  const rawClusters = candidate.clusters
    .map(cluster => {
      if (typeof cluster !== 'object' || cluster === null) {
        return null;
      }

      const title = asNonEmptyString(cluster.title);
      const targetKeyword = asNonEmptyString(cluster.targetKeyword);
      const funnelStage = asNonEmptyString(cluster.funnelStage);
      const searchIntent = asNonEmptyString(cluster.searchIntent);
      const anchorTextToPillar = asNonEmptyString(cluster.anchorTextToPillar);
      const summary = asNonEmptyString(cluster.summary);

      if (
        !title ||
        !targetKeyword ||
        !funnelStage ||
        !searchIntent ||
        !anchorTextToPillar ||
        !summary
      ) {
        return null;
      }

      return {
        title,
        targetKeyword,
        funnelStage,
        searchIntent,
        anchorTextToPillar,
        summary,
        lateralLinks: cluster.lateralLinks,
        semanticEntities: cluster.semanticEntities,
      };
    })
    .filter((cluster): cluster is NonNullable<typeof cluster> => cluster !== null);

  if (rawClusters.length < minClusters) {
    return null;
  }

  const clusters = rawClusters.slice(0, maxClusters);
  const clusterTitles = clusters.map(cluster => cluster.title);

  return {
    pillar: {
      title: pillarTitle,
      targetKeyword: pillarKeyword,
      summary: pillarSummary,
      primaryCallToAction: pillarCta,
    },
    clusters: clusters.map(cluster => ({
      title: cluster.title,
      targetKeyword: cluster.targetKeyword,
      funnelStage: cluster.funnelStage,
      searchIntent: cluster.searchIntent,
      anchorTextToPillar: cluster.anchorTextToPillar,
      summary: cluster.summary,
      lateralLinks: normalizeLateralLinks(
        cluster.lateralLinks,
        cluster.title,
        clusterTitles
      ),
      semanticEntities: normalizeSemanticEntities(
        cluster.semanticEntities,
        cluster.targetKeyword,
        cluster.title
      ),
    })),
  };
}

export function isHubSpokeMap(value: unknown): value is HubSpokeMap {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as HubSpokeMap;

  if (
    typeof candidate.pillar !== 'object' ||
    candidate.pillar === null ||
    typeof candidate.pillar.title !== 'string' ||
    typeof candidate.pillar.targetKeyword !== 'string' ||
    typeof candidate.pillar.summary !== 'string' ||
    typeof candidate.pillar.primaryCallToAction !== 'string'
  ) {
    return false;
  }

  if (!Array.isArray(candidate.clusters)) {
    return false;
  }

  if (candidate.clusters.length < 8 || candidate.clusters.length > 10) {
    return false;
  }

  return candidate.clusters.every(cluster => {
    if (typeof cluster !== 'object' || cluster === null) {
      return false;
    }

    const hasValidMetrics =
      cluster.searchVolume === undefined ||
      cluster.searchVolume === null ||
      typeof cluster.searchVolume === 'number';

    const hasValidDifficulty =
      cluster.keywordDifficulty === undefined ||
      cluster.keywordDifficulty === null ||
      typeof cluster.keywordDifficulty === 'number';

    return (
      typeof cluster.title === 'string' &&
      typeof cluster.targetKeyword === 'string' &&
      typeof cluster.funnelStage === 'string' &&
      typeof cluster.searchIntent === 'string' &&
      typeof cluster.anchorTextToPillar === 'string' &&
      Array.isArray(cluster.lateralLinks) &&
      cluster.lateralLinks.length >= 1 &&
      cluster.lateralLinks.length <= 2 &&
      cluster.lateralLinks.every(isLateralLink) &&
      Array.isArray(cluster.semanticEntities) &&
      cluster.semanticEntities.length >= 3 &&
      cluster.semanticEntities.length <= 5 &&
      cluster.semanticEntities.every(entity => typeof entity === 'string') &&
      typeof cluster.summary === 'string' &&
      hasValidMetrics &&
      hasValidDifficulty
    );
  });
}
