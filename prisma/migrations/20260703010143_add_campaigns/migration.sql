-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationName" TEXT NOT NULL DEFAULT 'Malaysia',
    "locationCode" INTEGER NOT NULL DEFAULT 458,
    "locationCoordinate" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "deviceType" TEXT NOT NULL DEFAULT 'desktop',
    "searchEngine" TEXT NOT NULL DEFAULT 'google_organic',
    "businessName" TEXT NOT NULL DEFAULT '',
    "competitorDomains" JSONB NOT NULL DEFAULT []
);
