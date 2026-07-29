-- Local Dominance: project-scoped geogrid audit history and cron schedules.

PRAGMA foreign_keys=OFF;

-- LocalAuditHistory: add projectId
CREATE TABLE "LocalAuditHistory_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "centralLat" REAL NOT NULL,
    "centralLng" REAL NOT NULL,
    "radiusKm" REAL NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'google',
    "businessName" TEXT,
    "businessCid" TEXT,
    "solvScore" REAL,
    "saivScore" REAL,
    "gridResults" JSONB NOT NULL,
    "aiVisibility" JSONB,
    "perplexityRecs" JSONB,
    "gbpMetrics" JSONB,
    "spamRadar" JSONB,
    "competitorShifts" JSONB,
    "trendData" JSONB,
    "scheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocalAuditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "LocalAuditHistory_new" (
    "id",
    "workspaceId",
    "projectId",
    "shareToken",
    "keyword",
    "centralLat",
    "centralLng",
    "radiusKm",
    "gridSize",
    "platform",
    "businessName",
    "businessCid",
    "solvScore",
    "saivScore",
    "gridResults",
    "aiVisibility",
    "perplexityRecs",
    "gbpMetrics",
    "spamRadar",
    "competitorShifts",
    "trendData",
    "scheduled",
    "createdAt",
    "updatedAt"
)
SELECT
    lah."id",
    lah."workspaceId",
    COALESCE(
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = lah."workspaceId"
            ORDER BY p."updatedAt" DESC
            LIMIT 1
        ),
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = lah."workspaceId"
            ORDER BY p."createdAt" ASC
            LIMIT 1
        )
    ),
    lah."shareToken",
    lah."keyword",
    lah."centralLat",
    lah."centralLng",
    lah."radiusKm",
    lah."gridSize",
    lah."platform",
    lah."businessName",
    lah."businessCid",
    lah."solvScore",
    lah."saivScore",
    lah."gridResults",
    lah."aiVisibility",
    lah."perplexityRecs",
    lah."gbpMetrics",
    lah."spamRadar",
    lah."competitorShifts",
    lah."trendData",
    lah."scheduled",
    lah."createdAt",
    lah."updatedAt"
FROM "LocalAuditHistory" lah
WHERE EXISTS (
    SELECT 1 FROM "Project" p WHERE p."workspaceId" = lah."workspaceId"
);

DROP TABLE "LocalAuditHistory";
ALTER TABLE "LocalAuditHistory_new" RENAME TO "LocalAuditHistory";

CREATE UNIQUE INDEX "LocalAuditHistory_shareToken_key" ON "LocalAuditHistory"("shareToken");
CREATE INDEX "LocalAuditHistory_workspaceId_createdAt_idx" ON "LocalAuditHistory"("workspaceId", "createdAt" DESC);
CREATE INDEX "LocalAuditHistory_projectId_createdAt_idx" ON "LocalAuditHistory"("projectId", "createdAt" DESC);
CREATE INDEX "LocalAuditHistory_workspaceId_projectId_idx" ON "LocalAuditHistory"("workspaceId", "projectId");

-- CronSchedule: add projectId
CREATE TABLE "CronSchedule_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL DEFAULT 'GEOGRID',
    "keyword" TEXT NOT NULL,
    "centralLat" REAL NOT NULL,
    "centralLng" REAL NOT NULL,
    "radiusKm" REAL NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'google',
    "businessName" TEXT,
    "businessCid" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastSolvScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CronSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "CronSchedule_new" (
    "id",
    "workspaceId",
    "projectId",
    "scheduleType",
    "keyword",
    "centralLat",
    "centralLng",
    "radiusKm",
    "gridSize",
    "platform",
    "businessName",
    "businessCid",
    "frequency",
    "isActive",
    "nextRunAt",
    "lastRunAt",
    "lastSolvScore",
    "createdAt",
    "updatedAt"
)
SELECT
    cs."id",
    cs."workspaceId",
    COALESCE(
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = cs."workspaceId"
            ORDER BY p."updatedAt" DESC
            LIMIT 1
        ),
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = cs."workspaceId"
            ORDER BY p."createdAt" ASC
            LIMIT 1
        )
    ),
    cs."scheduleType",
    cs."keyword",
    cs."centralLat",
    cs."centralLng",
    cs."radiusKm",
    cs."gridSize",
    cs."platform",
    cs."businessName",
    cs."businessCid",
    cs."frequency",
    cs."isActive",
    cs."nextRunAt",
    cs."lastRunAt",
    cs."lastSolvScore",
    cs."createdAt",
    cs."updatedAt"
FROM "CronSchedule" cs
WHERE EXISTS (
    SELECT 1 FROM "Project" p WHERE p."workspaceId" = cs."workspaceId"
);

DROP TABLE "CronSchedule";
ALTER TABLE "CronSchedule_new" RENAME TO "CronSchedule";

CREATE INDEX "CronSchedule_workspaceId_isActive_idx" ON "CronSchedule"("workspaceId", "isActive");
CREATE INDEX "CronSchedule_projectId_isActive_idx" ON "CronSchedule"("projectId", "isActive");
CREATE INDEX "CronSchedule_isActive_nextRunAt_idx" ON "CronSchedule"("isActive", "nextRunAt");

PRAGMA foreign_keys=ON;
