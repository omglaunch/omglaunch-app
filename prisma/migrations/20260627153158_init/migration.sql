-- CreateTable
CREATE TABLE "PageAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "targetKeyword" TEXT NOT NULL,
    "geoScore" REAL NOT NULL,
    "auditData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "RankTracking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keyword" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "seoScore" INTEGER NOT NULL
);
