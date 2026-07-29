-- Rank Tracker Phase 1: relational keyword + SERP history engine
-- Renames legacy snapshot table and adds new relational models.

-- CreateTable: tracked keywords scoped by campaign
CREATE TABLE "RankTrackerKeyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetUrl" TEXT,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "cpc" REAL NOT NULL DEFAULT 0,
    "intent" TEXT NOT NULL DEFAULT 'Informational',
    "keywordDifficulty" REAL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankTrackerKeyword_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Rename legacy tool-history snapshots (was RankTrackerHistory)
CREATE TABLE "RankTrackerSnapshotHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" TEXT NOT NULL
);

INSERT INTO "RankTrackerSnapshotHistory" ("id", "createdAt", "updatedAt", "workspaceId", "identifier", "resultData")
SELECT "id", "createdAt", "updatedAt", "workspaceId", "identifier", "resultData"
FROM "RankTrackerHistory";

DROP TABLE "RankTrackerHistory";

-- CreateTable: SERP position time-series (ON DELETE CASCADE via FK)
CREATE TABLE "RankTrackerHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keywordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "previousPosition" INTEGER NOT NULL,
    "urlFound" TEXT NOT NULL DEFAULT '',
    "isFeaturedSnippet" BOOLEAN NOT NULL DEFAULT false,
    "isLocalPack" BOOLEAN NOT NULL DEFAULT false,
    "serpFeaturesFound" TEXT NOT NULL DEFAULT '[]',
    "competitorRankings" TEXT NOT NULL DEFAULT '{}',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankTrackerHistory_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "RankTrackerKeyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RankTrackerKeyword_campaignId_idx" ON "RankTrackerKeyword"("campaignId");
CREATE UNIQUE INDEX "RankTrackerKeyword_campaignId_keyword_key" ON "RankTrackerKeyword"("campaignId", "keyword");
CREATE INDEX "RankTrackerHistory_keywordId_checkedAt_idx" ON "RankTrackerHistory"("keywordId", "checkedAt" DESC);
