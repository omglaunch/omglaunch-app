-- Extend workspace audit log for project-scoped brand/manifest history.

ALTER TABLE "AuditLogEntry" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AuditLogEntry" ADD COLUMN "category" TEXT;
ALTER TABLE "AuditLogEntry" ADD COLUMN "metadata" TEXT;

CREATE INDEX "AuditLogEntry_workspaceId_projectId_createdAt_idx"
  ON "AuditLogEntry"("workspaceId", "projectId", "createdAt" DESC);

CREATE INDEX "AuditLogEntry_workspaceId_category_createdAt_idx"
  ON "AuditLogEntry"("workspaceId", "category", "createdAt" DESC);
