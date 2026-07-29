-- Unify Rank Tracker onto SavedKeyword (single source of truth).

PRAGMA foreign_keys=OFF;

-- Extend SavedKeyword with rank-tracking fields.
ALTER TABLE "SavedKeyword" ADD COLUMN "targetUrl" TEXT;
ALTER TABLE "SavedKeyword" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SavedKeyword" ADD COLUMN "trackingFrequency" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "SavedKeyword" ADD COLUMN "nextCheckAt" DATETIME;

-- Copy legacy RankTrackerKeyword rows into SavedKeyword when the old table exists.
INSERT OR IGNORE INTO "SavedKeyword" (
  "id",
  "workspaceId",
  "projectId",
  "keyword",
  "location",
  "locationCode",
  "language",
  "languageCode",
  "searchEngine",
  "device",
  "searchVolume",
  "cpc",
  "intent",
  "kd",
  "tags",
  "targetUrl",
  "isActive",
  "trackingFrequency",
  "nextCheckAt",
  "createdAt"
)
SELECT
  rt."id",
  COALESCE(p."workspaceId", 'default-workspace'),
  rt."projectId",
  rt."keyword",
  'Malaysia',
  2458,
  'English',
  'en',
  'google',
  'desktop',
  rt."searchVolume",
  rt."cpc",
  rt."intent",
  CAST(rt."keywordDifficulty" AS INTEGER),
  rt."tags",
  rt."targetUrl",
  rt."isActive",
  rt."trackingFrequency",
  rt."nextCheckAt",
  rt."createdAt"
FROM "RankTrackerKeyword" rt
LEFT JOIN "Project" p ON p."id" = rt."projectId";

-- Rebuild RankTrackerHistory to reference SavedKeyword.
CREATE TABLE "RankTrackerHistory_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "savedKeywordId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "previousPosition" INTEGER NOT NULL,
  "urlFound" TEXT NOT NULL DEFAULT '',
  "isFeaturedSnippet" BOOLEAN NOT NULL DEFAULT false,
  "isLocalPack" BOOLEAN NOT NULL DEFAULT false,
  "serpFeaturesFound" JSONB NOT NULL,
  "competitorRankings" JSONB NOT NULL,
  "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankTrackerHistory_savedKeywordId_fkey" FOREIGN KEY ("savedKeywordId") REFERENCES "SavedKeyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RankTrackerHistory_new" (
  "id",
  "savedKeywordId",
  "position",
  "previousPosition",
  "urlFound",
  "isFeaturedSnippet",
  "isLocalPack",
  "serpFeaturesFound",
  "competitorRankings",
  "checkedAt"
)
SELECT
  h."id",
  h."keywordId",
  h."position",
  h."previousPosition",
  h."urlFound",
  h."isFeaturedSnippet",
  h."isLocalPack",
  h."serpFeaturesFound",
  h."competitorRankings",
  h."checkedAt"
FROM "RankTrackerHistory" h;

DROP TABLE "RankTrackerHistory";
ALTER TABLE "RankTrackerHistory_new" RENAME TO "RankTrackerHistory";
CREATE INDEX "RankTrackerHistory_savedKeywordId_checkedAt_idx" ON "RankTrackerHistory"("savedKeywordId", "checkedAt" DESC);

DROP TABLE IF EXISTS "RankTrackerKeyword";

PRAGMA foreign_keys=ON;
