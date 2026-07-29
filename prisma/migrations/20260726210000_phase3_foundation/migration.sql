-- Phase 3 foundation: project-scoped published articles, domain manifests, viewer project assignments.

-- TeamMember: client portal project allowlist
ALTER TABLE "TeamMember" ADD COLUMN "assignedProjectIds" JSONB NOT NULL DEFAULT '[]';

PRAGMA foreign_keys=OFF;

-- PublishedGapArticle: add projectId
CREATE TABLE "PublishedGapArticle_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "jsonLd" JSONB NOT NULL,
    "cluster" TEXT,
    "geoLabel" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublishedGapArticle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "PublishedGapArticle_new" (
    "id",
    "workspaceId",
    "projectId",
    "slug",
    "title",
    "content",
    "metadata",
    "jsonLd",
    "cluster",
    "geoLabel",
    "publishedAt",
    "updatedAt"
)
SELECT
    pga."id",
    pga."workspaceId",
    COALESCE(
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = pga."workspaceId"
            ORDER BY p."updatedAt" DESC
            LIMIT 1
        ),
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = pga."workspaceId"
            ORDER BY p."createdAt" ASC
            LIMIT 1
        )
    ),
    pga."slug",
    pga."title",
    pga."content",
    pga."metadata",
    pga."jsonLd",
    pga."cluster",
    pga."geoLabel",
    pga."publishedAt",
    pga."updatedAt"
FROM "PublishedGapArticle" pga
WHERE EXISTS (
    SELECT 1 FROM "Project" p WHERE p."workspaceId" = pga."workspaceId"
);

DROP TABLE "PublishedGapArticle";
ALTER TABLE "PublishedGapArticle_new" RENAME TO "PublishedGapArticle";

CREATE UNIQUE INDEX "PublishedGapArticle_slug_key" ON "PublishedGapArticle"("slug");
CREATE INDEX "PublishedGapArticle_workspaceId_idx" ON "PublishedGapArticle"("workspaceId");
CREATE INDEX "PublishedGapArticle_projectId_idx" ON "PublishedGapArticle"("projectId");
CREATE INDEX "PublishedGapArticle_projectId_cluster_idx" ON "PublishedGapArticle"("projectId", "cluster");

-- DomainProfileManifest: workspace → project scope
CREATE TABLE "DomainProfileManifest_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "entityType" TEXT NOT NULL DEFAULT 'Organization',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainProfileManifest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "DomainProfileManifest_new" (
    "id",
    "projectId",
    "manifest",
    "manifestVersion",
    "entityType",
    "updatedAt",
    "createdAt"
)
SELECT
    dpm."id",
    COALESCE(
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = dpm."workspaceId"
            ORDER BY p."updatedAt" DESC
            LIMIT 1
        ),
        (
            SELECT p."id"
            FROM "Project" p
            WHERE p."workspaceId" = dpm."workspaceId"
            ORDER BY p."createdAt" ASC
            LIMIT 1
        )
    ),
    dpm."manifest",
    dpm."manifestVersion",
    dpm."entityType",
    dpm."updatedAt",
    dpm."createdAt"
FROM "DomainProfileManifest" dpm
WHERE EXISTS (
    SELECT 1 FROM "Project" p WHERE p."workspaceId" = dpm."workspaceId"
);

DROP TABLE "DomainProfileManifest";
ALTER TABLE "DomainProfileManifest_new" RENAME TO "DomainProfileManifest";

CREATE UNIQUE INDEX "DomainProfileManifest_projectId_key" ON "DomainProfileManifest"("projectId");
CREATE INDEX "DomainProfileManifest_projectId_idx" ON "DomainProfileManifest"("projectId");

PRAGMA foreign_keys=ON;
