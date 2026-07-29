-- CreateTable
CREATE TABLE "VisibilityPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptCluster" TEXT NOT NULL,
    "aiSearchVol" INTEGER,
    "aiSearchVolConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "organicRank" INTEGER,
    "geoTarget" TEXT NOT NULL,
    "geoLocationId" TEXT,
    "geoTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "userTargetUrl" TEXT NOT NULL,
    "brandAliases" JSONB NOT NULL DEFAULT '[]',
    "persistenceTrend" JSONB NOT NULL DEFAULT '[]',
    "lastSyncedAt" DATETIME NOT NULL,
    "lastActionAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "nextCronRun" DATETIME,
    "googleAio" JSONB NOT NULL,
    "perplexity" JSONB NOT NULL,
    "chatgpt" JSONB NOT NULL,
    "claude" JSONB NOT NULL,
    "competitorThreat" JSONB NOT NULL,
    "rowSyncState" TEXT NOT NULL DEFAULT 'idle',
    "deepScanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisibilityPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityPrompt_projectId_prompt_key" ON "VisibilityPrompt"("projectId", "prompt");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_suspended_idx" ON "VisibilityPrompt"("projectId", "suspended");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_updatedAt_idx" ON "VisibilityPrompt"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_sortOrder_idx" ON "VisibilityPrompt"("projectId", "sortOrder");
