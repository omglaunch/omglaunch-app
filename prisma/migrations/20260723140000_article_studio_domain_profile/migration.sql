-- CreateTable
CREATE TABLE "PublishedGapArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "jsonLd" JSONB NOT NULL,
    "cluster" TEXT,
    "geoLabel" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DomainProfileManifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "entityType" TEXT NOT NULL DEFAULT 'Organization',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishedGapArticle_slug_key" ON "PublishedGapArticle"("slug");

-- CreateIndex
CREATE INDEX "PublishedGapArticle_workspaceId_idx" ON "PublishedGapArticle"("workspaceId");

-- CreateIndex
CREATE INDEX "PublishedGapArticle_workspaceId_cluster_idx" ON "PublishedGapArticle"("workspaceId", "cluster");

-- CreateIndex
CREATE UNIQUE INDEX "DomainProfileManifest_workspaceId_key" ON "DomainProfileManifest"("workspaceId");

-- CreateIndex
CREATE INDEX "DomainProfileManifest_workspaceId_idx" ON "DomainProfileManifest"("workspaceId");
