-- CreateTable
CREATE TABLE "SeoAnalysisHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "SemanticAnalysisHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "AnalysisAIHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "CompetitorCompareHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "PageAuditHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "HubSpokeHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "ArticleStudioHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "QueryComparisonHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "KeywordAuditHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "ResearchVolumesHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "SuggestedKeywordsHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "RankTrackerHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "AIContentWriterHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "CMSPublishingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL
);
