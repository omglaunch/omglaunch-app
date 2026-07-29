-- CreateTable
CREATE TABLE "AeoBrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "brandLabel" TEXT NOT NULL,
    "primaryUrl" TEXT NOT NULL,
    "brandAliases" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AeoBrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AeoBrandProfile_projectId_key" ON "AeoBrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "AeoBrandProfile_projectId_idx" ON "AeoBrandProfile"("projectId");
