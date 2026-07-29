-- CreateIndex
CREATE INDEX "SavedKeyword_workspaceId_projectId_idx" ON "SavedKeyword"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "SavedKeyword_workspaceId_isActive_nextCheckAt_idx" ON "SavedKeyword"("workspaceId", "isActive", "nextCheckAt");
