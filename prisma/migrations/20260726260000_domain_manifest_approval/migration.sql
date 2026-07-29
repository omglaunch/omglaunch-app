-- Draft vs published approval workflow for domain profile manifests.

ALTER TABLE "DomainProfileManifest" ADD COLUMN "draftManifest" TEXT;
ALTER TABLE "DomainProfileManifest" ADD COLUMN "draftManifestVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DomainProfileManifest" ADD COLUMN "draftUpdatedAt" DATETIME;
ALTER TABLE "DomainProfileManifest" ADD COLUMN "manifestStatus" TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "DomainProfileManifest" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "DomainProfileManifest" ADD COLUMN "publishedByUserId" TEXT;

UPDATE "DomainProfileManifest"
SET
  "draftManifest" = "manifest",
  "draftManifestVersion" = "manifestVersion",
  "draftUpdatedAt" = "updatedAt",
  "publishedAt" = "updatedAt",
  "manifestStatus" = 'PUBLISHED'
WHERE "draftManifest" IS NULL;

CREATE INDEX "DomainProfileManifest_manifestStatus_idx" ON "DomainProfileManifest"("manifestStatus");
