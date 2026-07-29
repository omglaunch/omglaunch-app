-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "targetKeyword" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "briefId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Article_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ContentBrief" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HubSpokeMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "seedKeyword" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Malaysia',
    "mapData" JSONB NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_briefId_key" ON "Article"("briefId");
