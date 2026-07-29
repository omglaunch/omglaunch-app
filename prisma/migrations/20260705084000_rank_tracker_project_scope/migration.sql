-- Rank Tracker: scope keywords by Project instead of Campaign.
-- Maps legacy campaignId values to Project.id (1:1 for existing Campaign rows).

INSERT OR IGNORE INTO "Project" ("id", "workspaceId", "name", "domain", "createdAt", "updatedAt")
SELECT "id", 'default-workspace', "name", NULLIF("domain", ''), "createdAt", CURRENT_TIMESTAMP
FROM "Campaign";

INSERT OR IGNORE INTO "Project" ("id", "workspaceId", "name", "domain", "createdAt", "updatedAt")
VALUES ('default-workspace', 'default-workspace', 'Main Project', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

PRAGMA foreign_keys=OFF;

CREATE TABLE "RankTrackerKeyword_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetUrl" TEXT,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "cpc" REAL NOT NULL DEFAULT 0,
    "intent" TEXT NOT NULL DEFAULT 'Informational',
    "keywordDifficulty" REAL,
    "tags" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackingFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "nextCheckAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankTrackerKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RankTrackerKeyword_new" (
    "id",
    "projectId",
    "keyword",
    "targetUrl",
    "searchVolume",
    "cpc",
    "intent",
    "keywordDifficulty",
    "tags",
    "isActive",
    "trackingFrequency",
    "nextCheckAt",
    "createdAt"
)
SELECT
    "id",
    "campaignId",
    "keyword",
    "targetUrl",
    "searchVolume",
    "cpc",
    "intent",
    "keywordDifficulty",
    "tags",
    "isActive",
    "trackingFrequency",
    "nextCheckAt",
    "createdAt"
FROM "RankTrackerKeyword";

DROP TABLE "RankTrackerKeyword";

ALTER TABLE "RankTrackerKeyword_new" RENAME TO "RankTrackerKeyword";

CREATE INDEX "RankTrackerKeyword_projectId_idx" ON "RankTrackerKeyword"("projectId");
CREATE UNIQUE INDEX "RankTrackerKeyword_projectId_keyword_key" ON "RankTrackerKeyword"("projectId", "keyword");

PRAGMA foreign_keys=ON;
