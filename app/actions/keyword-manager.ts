'use server';

import { filterProjectsForAccess, assertWorkspaceWriteAccess, requireAccessibleProjectWriteId } from '@/lib/projects/team-access';
import { resolveClientBrandLabel } from '@/lib/projects/client-brand';
import { getOwnedProject, requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { validateProjectDomainChange } from '@/lib/projects/project-domain-update';
import { getPrisma } from '@/lib/prisma';
import { harvestRankFromLabsPayload } from '@/lib/rank-tracker/serp-harvest';
import { stringifyCompetingPages } from '@/lib/rank-tracker/cannibalization';
import { getValidCache } from '@/lib/services/cacheService';

export type KeywordManagerProject = {
  id: string;
  workspaceId: string;
  name: string;
  brandLabel: string;
  domain: string | null;
  locationCode: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveKeywordInput = {
  keyword: string;
  location: string;
  locationCode?: number | null;
  language: string;
  languageCode?: string | null;
  searchEngine?: string;
  device?: string;
  searchVolume?: number | null;
  cpc?: number | null;
  intent?: string | null;
  kd?: number | null;
  /** Raw DataForSEO Labs item for zero-cost SERP rank harvest. */
  rawLabsPayload?: unknown;
};

export type SaveKeywordsResult = {
  created: number;
  skipped: number;
  total: number;
  harvested: number;
  error?: string;
};

function serializeProject(record: {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  createdAt: Date;
  updatedAt: Date;
  keywords?: Array<{ locationCode: number | null }>;
  aeoBrandProfile?: { brandLabel: string } | null;
}): KeywordManagerProject {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    brandLabel: resolveClientBrandLabel({
      brandLabel: record.aeoBrandProfile?.brandLabel,
      projectName: record.name,
    }),
    domain: record.domain,
    locationCode: record.keywords?.[0]?.locationCode ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags?.length) return [];
  return Array.from(
    new Set(tags.map(tag => tag.trim()).filter(Boolean))
  );
}

function formatIntent(intent: string | null | undefined): string | null {
  if (!intent?.trim()) return null;
  const normalized = intent.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findLabsItemByKeyword(
  cachedResult: unknown,
  keyword: string
): unknown | null {
  if (!cachedResult || typeof cachedResult !== 'object') return null;

  const normalized = normalizeKeyword(keyword);
  const resultBlocks = Array.isArray(cachedResult)
    ? cachedResult
    : [cachedResult];

  for (const block of resultBlocks) {
    if (!block || typeof block !== 'object') continue;
    const items = (block as { items?: unknown[] }).items ?? [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const record = item as {
        keyword?: string;
        keyword_data?: { keyword?: string };
      };

      const expression =
        record.keyword_data?.keyword?.trim() || record.keyword?.trim() || '';
      if (expression && normalizeKeyword(expression) === normalized) {
        return item;
      }
    }
  }

  return null;
}

async function resolveLabsPayloadForHarvest(
  entry: Partial<SaveKeywordInput>
): Promise<unknown> {
  if (entry.rawLabsPayload != null) {
    return entry.rawLabsPayload;
  }

  const keyword = entry.keyword?.trim();
  const location = entry.location?.trim();
  const language = entry.language?.trim();
  if (!keyword || !location || !language) return null;

  const device = entry.device?.trim() || 'desktop';
  const searchEngine = entry.searchEngine?.trim() || 'google';

  for (const endpoint of ['related_keywords', 'keyword_ideas'] as const) {
    const cached = await getValidCache(
      endpoint,
      keyword,
      location,
      language,
      device,
      searchEngine
    );
    if (!cached) continue;

    const match = findLabsItemByKeyword(cached, keyword);
    if (match) return match;
  }

  return null;
}

function applyHarvestToRow(
  baseRow: {
    workspaceId: string;
    projectId: string;
    keyword: string;
    location: string;
    locationCode: number | null;
    language: string;
    languageCode: string | null;
    searchEngine: string;
    device: string;
    searchVolume: number | null;
    cpc: number | null;
    intent: string | null;
    kd: number | null;
    tags: string[];
    isActive: boolean;
    trackingFrequency: string;
    nextCheckAt: Date;
  },
  harvest: ReturnType<typeof harvestRankFromLabsPayload>,
  now: Date
) {
  if (!harvest) {
    return {
      ...baseRow,
      currentRank: null,
      rankedUrl: null,
      competingPages: null,
      lastTrackedAt: null,
    };
  }

  return {
    ...baseRow,
    currentRank: harvest.currentRank,
    rankedUrl: harvest.rankedUrl || null,
    competingPages: stringifyCompetingPages(harvest.competingPages),
    lastTrackedAt: now,
    initialRank: harvest.currentRank,
  };
}

export async function getProjects(): Promise<KeywordManagerProject[]> {
  const workspaceId = await requireWorkspaceId();

  const records = await getPrisma().project.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      aeoBrandProfile: { select: { brandLabel: true } },
      keywords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { locationCode: true },
      },
    },
  });

  const projects = records.map(serializeProject);
  return filterProjectsForAccess(projects);
}

export async function createProject(
  name: string,
  domain?: string
): Promise<KeywordManagerProject> {
  await assertWorkspaceWriteAccess();
  const workspaceId = await requireWorkspaceId();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Project name is required.');
  }

  const record = await getPrisma().project.create({
    data: {
      workspaceId,
      name: trimmedName,
      domain: domain?.trim() || null,
    },
    include: {
      keywords: {
        take: 1,
        select: { locationCode: true },
      },
    },
  });

  return serializeProject(record);
}

export type UpdateProjectDomainResult = {
  project: KeywordManagerProject;
  domainWarning?: string;
};

export async function updateProjectDomain(
  projectId: string,
  domain: string | null
): Promise<UpdateProjectDomainResult> {
  await assertWorkspaceWriteAccess();
  const workspaceId = await requireWorkspaceId();
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    throw new Error('Project is required.');
  }

  await requireAccessibleProjectWriteId(trimmedProjectId);
  const existing = await getOwnedProject(trimmedProjectId, workspaceId);
  if (!existing) {
    throw new Error('Project not found.');
  }

  const nextDomain = domain?.trim() || null;
  const domainValidation = await validateProjectDomainChange(trimmedProjectId, nextDomain);
  if (!domainValidation.ok) {
    throw new Error(domainValidation.error);
  }

  const record = await getPrisma().project.update({
    where: { id: trimmedProjectId },
    data: { domain: nextDomain },
    include: {
      keywords: {
        take: 1,
        select: { locationCode: true },
      },
    },
  });

  return {
    project: serializeProject(record),
    domainWarning: domainValidation.warning,
  };
}

export async function saveKeywords(
  projectId: string,
  keywords: Array<Partial<SaveKeywordInput>>,
  tags?: string[]
): Promise<SaveKeywordsResult> {
  const workspaceId = await requireWorkspaceId();
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return {
      created: 0,
      skipped: 0,
      total: 0,
      harvested: 0,
      error: 'Project is required.',
    };
  }

  if (!keywords.length) {
    return {
      created: 0,
      skipped: 0,
      total: 0,
      harvested: 0,
      error: 'No keywords to save.',
    };
  }

  try {
    await requireAccessibleProjectWriteId(trimmedProjectId);
  } catch (error) {
    return {
      created: 0,
      skipped: 0,
      total: keywords.length,
      harvested: 0,
      error: error instanceof Error ? error.message : 'Project access denied.',
    };
  }

  const project = await getOwnedProject(trimmedProjectId, workspaceId);
  if (!project) {
    return {
      created: 0,
      skipped: 0,
      total: keywords.length,
      harvested: 0,
      error: 'Project not found or access denied.',
    };
  }

  // TODO: Check tenant keyword limitations/quota allocation here

  const mergedTags = normalizeTags(tags);
  const now = new Date();

  const parsedEntries = await Promise.all(
    keywords.map(async entry => {
      const keyword = entry.keyword?.trim();
      const location = entry.location?.trim();
      const language = entry.language?.trim();

      if (!keyword || !location || !language) {
        return null;
      }

      const baseRow = {
        workspaceId,
        projectId: trimmedProjectId,
        keyword,
        location,
        locationCode:
          typeof entry.locationCode === 'number' && Number.isFinite(entry.locationCode)
            ? Math.trunc(entry.locationCode)
            : null,
        language,
        languageCode: entry.languageCode?.trim() || null,
        searchEngine: entry.searchEngine?.trim() || 'google',
        device: entry.device?.trim() || 'desktop',
        searchVolume:
          typeof entry.searchVolume === 'number' && Number.isFinite(entry.searchVolume)
            ? Math.trunc(entry.searchVolume)
            : null,
        cpc:
          typeof entry.cpc === 'number' && Number.isFinite(entry.cpc) ? entry.cpc : null,
        intent: formatIntent(entry.intent),
        kd:
          typeof entry.kd === 'number' && Number.isFinite(entry.kd)
            ? Math.trunc(entry.kd)
            : null,
        tags: mergedTags,
        isActive: true,
        trackingFrequency: 'WEEKLY',
        nextCheckAt: now,
      };

      const labsPayload = await resolveLabsPayloadForHarvest(entry);
      const harvest = harvestRankFromLabsPayload(labsPayload, project.domain);

      return applyHarvestToRow(baseRow, harvest, now);
    })
  );

  const rows = parsedEntries.filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) {
    return {
      created: 0,
      skipped: keywords.length,
      total: keywords.length,
      harvested: 0,
      error: 'No valid keywords to save.',
    };
  }

  type DedupeFields = {
    keyword: string;
    location: string;
    language: string;
    searchEngine: string;
    device: string;
  };

  const dedupeKey = (row: DedupeFields) =>
    `${row.keyword}|${row.location}|${row.language}|${row.searchEngine}|${row.device}`;

  const existing = await getPrisma().savedKeyword.findMany({
    where: {
      workspaceId,
      projectId: trimmedProjectId,
      OR: rows.map(row => ({
        keyword: row.keyword,
        location: row.location,
        language: row.language,
        searchEngine: row.searchEngine,
        device: row.device,
      })),
    },
    select: {
      keyword: true,
      location: true,
      language: true,
      searchEngine: true,
      device: true,
    },
  });

  const existingKeys = new Set(existing.map(dedupeKey));
  const newRows = rows.filter(row => !existingKeys.has(dedupeKey(row)));

  if (!newRows.length) {
    return {
      created: 0,
      skipped: rows.length,
      total: rows.length,
      harvested: 0,
    };
  }

  await getPrisma().$transaction(
    newRows.map(row =>
      getPrisma().savedKeyword.create({
        data: row,
      })
    )
  );

  const harvested = newRows.filter(row => row.currentRank != null).length;

  return {
    created: newRows.length,
    skipped: rows.length - newRows.length,
    total: rows.length,
    harvested,
  };
}
