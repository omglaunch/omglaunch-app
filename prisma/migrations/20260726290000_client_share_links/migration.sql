-- Public client report share links (rank tracker, AI visibility, page audit).

CREATE TABLE "ClientShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareToken" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClientShareLink_shareToken_key" ON "ClientShareLink"("shareToken");
CREATE INDEX "ClientShareLink_workspaceId_idx" ON "ClientShareLink"("workspaceId");
CREATE INDEX "ClientShareLink_projectId_idx" ON "ClientShareLink"("projectId");
CREATE INDEX "ClientShareLink_reportType_idx" ON "ClientShareLink"("reportType");
