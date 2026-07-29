-- Scope published gap article slugs per project instead of workspace-wide.

DROP INDEX "PublishedGapArticle_slug_key";
CREATE UNIQUE INDEX "PublishedGapArticle_projectId_slug_key" ON "PublishedGapArticle"("projectId", "slug");
