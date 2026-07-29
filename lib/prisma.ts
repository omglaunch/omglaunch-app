import { PrismaClient, Prisma } from '@prisma/client';
import {
  createTenantScopedPrismaClient,
  type TenantScopedPrismaClient,
} from '@/lib/prisma/tenant-extension';

/** Bump when schema changes require a fresh PrismaClient (dev hot-reload keeps stale instances). */
const PRISMA_CLIENT_VERSION = 23;

const REQUIRED_DELEGATES = [
  'keywordCache',
  'savedKeyword',
  'workspaceSettings',
  'keywordAuditHistory',
  'topicalMap',
  'clusterNode',
  'systemConfiguration',
  'adminAuditLog',
  'localAuditHistory',
  'cronSchedule',
  'serviceAreaPageJob',
  'siloProject',
  'siloNode',
  'visibilityPrompt',
  'clientShareLink',
] as const;

const globalForPrisma = globalThis as unknown as {
  prisma: TenantScopedPrismaClient | undefined;
  prismaClientVersion?: number;
};

function clearPrismaRequireCache(): void {
  for (const moduleId of Object.keys(require.cache)) {
    if (
      moduleId.includes(`${require('path').sep}@prisma${require('path').sep}`) ||
      moduleId.includes(`${require('path').sep}.prisma${require('path').sep}`)
    ) {
      delete require.cache[moduleId];
    }
  }
}

function createPrismaClient(): TenantScopedPrismaClient {
  // For production Postgres: use a pooled connection string (Prisma Accelerate or PgBouncer)
  // e.g. DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
  const baseClient = new PrismaClient();
  return createTenantScopedPrismaClient(baseClient);
}

function hasDelegate(
  client: TenantScopedPrismaClient,
  model: (typeof REQUIRED_DELEGATES)[number]
): boolean {
  const delegate = (client as Record<string, { create?: unknown } | undefined>)[model];
  return Boolean(delegate && typeof delegate.create === 'function');
}

function getRuntimeModelFields(
  client: PrismaClient,
  modelName: string
): Set<string> {
  const runtimeModel = (
    client as PrismaClient & {
      _runtimeDataModel?: { models?: Record<string, { fields?: { name: string }[] }> };
    }
  )._runtimeDataModel?.models?.[modelName];

  return new Set(runtimeModel?.fields?.map(field => field.name) ?? []);
}

function hasTopicalMapMetadataFields(client: PrismaClient): boolean {
  if ('source' in Prisma.TopicalMapScalarFieldEnum) {
    return 'semanticGaps' in Prisma.TopicalMapScalarFieldEnum;
  }

  const fieldNames = getRuntimeModelFields(client, 'TopicalMap');
  return fieldNames.has('source') && fieldNames.has('semanticGaps');
}

function hasSiloNodeMetadataFields(client: PrismaClient): boolean {
  if ('summary' in Prisma.SiloNodeScalarFieldEnum) {
    return 'semanticEntities' in Prisma.SiloNodeScalarFieldEnum;
  }

  const fieldNames = getRuntimeModelFields(client, 'SiloNode');
  return fieldNames.has('summary') && fieldNames.has('semanticEntities');
}

function hasSiloProjectSemanticGapFields(client: PrismaClient): boolean {
  if ('semanticGaps' in Prisma.SiloProjectScalarFieldEnum) {
    return 'keywordsAnalyzed' in Prisma.SiloProjectScalarFieldEnum;
  }

  const fieldNames = getRuntimeModelFields(client, 'SiloProject');
  return fieldNames.has('semanticGaps') && fieldNames.has('keywordsAnalyzed');
}

function hasSiloProjectImportField(client: PrismaClient): boolean {
  if ('importedFromTopicalMapId' in Prisma.SiloProjectScalarFieldEnum) {
    return true;
  }

  return getRuntimeModelFields(client, 'SiloProject').has('importedFromTopicalMapId');
}

function hasSiloProjectRankedKeywordsField(client: PrismaClient): boolean {
  if ('rankedKeywords' in Prisma.SiloProjectScalarFieldEnum) {
    return true;
  }

  return getRuntimeModelFields(client, 'SiloProject').has('rankedKeywords');
}

function hasSiloProjectHubGroupsField(client: PrismaClient): boolean {
  if ('hubGroups' in Prisma.SiloProjectScalarFieldEnum) {
    return true;
  }

  return getRuntimeModelFields(client, 'SiloProject').has('hubGroups');
}

function hasSiloNodeMetricsConfidenceFields(client: PrismaClient): boolean {
  if ('metricsConfidence' in Prisma.SiloNodeScalarFieldEnum) {
    return 'keywordSource' in Prisma.SiloNodeScalarFieldEnum;
  }

  const fieldNames = getRuntimeModelFields(client, 'SiloNode');
  return fieldNames.has('metricsConfidence') && fieldNames.has('keywordSource');
}

function isCachedPrismaClientFresh(client: TenantScopedPrismaClient): boolean {
  const baseClient = client as unknown as PrismaClient;

  return (
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION &&
    REQUIRED_DELEGATES.every(model => hasDelegate(client, model)) &&
    hasTopicalMapMetadataFields(baseClient) &&
    hasSiloNodeMetadataFields(baseClient) &&
    hasSiloNodeMetricsConfidenceFields(baseClient) &&
    hasSiloProjectSemanticGapFields(baseClient) &&
    hasSiloProjectImportField(baseClient) &&
    hasSiloProjectRankedKeywordsField(baseClient) &&
    hasSiloProjectHubGroupsField(baseClient)
  );
}

export function getPrisma(): TenantScopedPrismaClient {
  const cached = globalForPrisma.prisma;

  if (cached && isCachedPrismaClientFresh(cached)) {
    return cached;
  }

  if (cached) {
    void (cached as TenantScopedPrismaClient).$disconnect().catch(() => undefined);
    clearPrismaRequireCache();
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  return client;
}

/**
 * Always resolves the current global Prisma client so hot-reload / schema bumps
 * cannot leave importers holding a stale delegate missing new models.
 */
export const prisma: TenantScopedPrismaClient = new Proxy({} as TenantScopedPrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export default prisma;
