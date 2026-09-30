-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "PageAudit" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "targetKeyword" TEXT NOT NULL,
    "geoScore" DOUBLE PRECISION NOT NULL,
    "auditData" JSONB NOT NULL,

    CONSTRAINT "PageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankTracking" (
    "id" SERIAL NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keyword" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,

    CONSTRAINT "RankTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" SERIAL NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "seoScore" INTEGER NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" SERIAL NOT NULL,
    "targetKeyword" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "briefId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubSpokeMap" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seedKeyword" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Malaysia',
    "mapData" JSONB NOT NULL,

    CONSTRAINT "HubSpokeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicalMap" (
    "id" TEXT NOT NULL,
    "seedKeyword" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Malaysia',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "source" TEXT NOT NULL DEFAULT 'HUB_SPOKE',
    "competitorDomain" TEXT,
    "coreNiche" TEXT,
    "semanticGaps" JSONB,
    "keywordsAnalyzed" INTEGER,
    "pillarTitle" TEXT NOT NULL,
    "pillarKeyword" TEXT NOT NULL,
    "pillarSummary" TEXT NOT NULL,
    "pillarCta" TEXT NOT NULL,

    CONSTRAINT "TopicalMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterNode" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "funnelStage" TEXT NOT NULL,
    "suggestedAnchorText" TEXT NOT NULL,
    "lateralLinks" JSONB NOT NULL,
    "searchVolume" INTEGER,
    "keywordDifficulty" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "summary" TEXT NOT NULL,
    "semanticEntities" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClusterNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationName" TEXT NOT NULL DEFAULT 'Malaysia',
    "locationCode" INTEGER NOT NULL DEFAULT 2458,
    "locationCoordinate" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "deviceType" TEXT NOT NULL DEFAULT 'desktop',
    "searchEngine" TEXT NOT NULL DEFAULT 'google_organic',
    "businessName" TEXT NOT NULL DEFAULT '',
    "competitorDomains" JSONB NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankTrackerHistory" (
    "id" TEXT NOT NULL,
    "savedKeywordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "previousPosition" INTEGER NOT NULL,
    "urlFound" TEXT NOT NULL DEFAULT '',
    "rankedUrl" TEXT,
    "competingPages" TEXT,
    "isFeaturedSnippet" BOOLEAN NOT NULL DEFAULT false,
    "isLocalPack" BOOLEAN NOT NULL DEFAULT false,
    "serpFeaturesFound" JSONB NOT NULL,
    "competitorRankings" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankTrackerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAnalysisHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "SeoAnalysisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanticAnalysisHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "SemanticAnalysisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisAIHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "AnalysisAIHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorCompareHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "CompetitorCompareHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAuditHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "PageAuditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubSpokeHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "HubSpokeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleStudioHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "ArticleStudioHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryComparisonHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "QueryComparisonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordAuditHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "language" TEXT,
    "device" TEXT,
    "searchVolume" INTEGER,
    "keywordDifficulty" INTEGER,
    "topCompetitors" JSONB,

    CONSTRAINT "KeywordAuditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchVolumesHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "ResearchVolumesHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedKeywordsHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "SuggestedKeywordsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankTrackerSnapshotHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "RankTrackerSnapshotHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIContentWriterHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "AIContentWriterHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CMSPublishingHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default-workspace',
    "identifier" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,

    CONSTRAINT "CMSPublishingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordCache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "searchEngine" TEXT NOT NULL DEFAULT 'google',
    "apiResponse" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilityPrompt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptCluster" TEXT NOT NULL,
    "aiSearchVol" INTEGER,
    "aiSearchVolConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "organicRank" INTEGER,
    "geoTarget" TEXT NOT NULL,
    "geoLocationId" TEXT,
    "geoTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "userTargetUrl" TEXT NOT NULL,
    "brandAliases" JSONB NOT NULL DEFAULT '[]',
    "persistenceTrend" JSONB NOT NULL DEFAULT '[]',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "lastActionAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextCronRun" TIMESTAMP(3),
    "googleAio" JSONB NOT NULL,
    "perplexity" JSONB NOT NULL,
    "chatgpt" JSONB NOT NULL,
    "claude" JSONB NOT NULL,
    "competitorThreat" JSONB NOT NULL,
    "rowSyncState" TEXT NOT NULL DEFAULT 'idle',
    "deepScanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisibilityPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AeoBrandProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandLabel" TEXT NOT NULL,
    "primaryUrl" TEXT NOT NULL,
    "brandAliases" JSONB NOT NULL DEFAULT '[]',
    "entityType" TEXT NOT NULL DEFAULT 'Organization',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "sameAsUrls" JSONB NOT NULL DEFAULT '[]',
    "manifestRegenRequestedAt" TIMESTAMP(3),
    "manifestRegenCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AeoBrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedKeyword" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "locationCode" INTEGER,
    "language" TEXT NOT NULL,
    "languageCode" TEXT,
    "searchEngine" TEXT NOT NULL DEFAULT 'google',
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "searchVolume" INTEGER,
    "cpc" DOUBLE PRECISION,
    "intent" TEXT,
    "kd" INTEGER,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "targetUrl" TEXT,
    "rankedUrl" TEXT,
    "competingPages" TEXT,
    "initialRank" INTEGER,
    "currentRank" INTEGER,
    "lastTrackedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackingFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "byokEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Workspace',
    "primaryIndustry" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "hideApiCostsFromViewer" BOOLEAN NOT NULL DEFAULT true,
    "hideUsageMetricsFromViewer" BOOLEAN NOT NULL DEFAULT false,
    "defaultCountry" TEXT NOT NULL DEFAULT 'Malaysia',
    "defaultState" TEXT NOT NULL DEFAULT '',
    "defaultGoogleDomain" TEXT NOT NULL DEFAULT 'google.com.my',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "defaultDevice" TEXT NOT NULL DEFAULT 'desktop',
    "rankDropThreshold" INTEGER NOT NULL DEFAULT 5,
    "cannibalizationNotify" BOOLEAN NOT NULL DEFAULT true,
    "emailDigestWeekly" BOOLEAN NOT NULL DEFAULT false,
    "pushToWebhook" BOOLEAN NOT NULL DEFAULT false,
    "reportLogoUrl" TEXT,
    "brandPrimaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "customDomain" TEXT,
    "planName" TEXT NOT NULL DEFAULT 'Pro Plan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "openaiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "geminiApiKey" TEXT,
    "perplexityApiKey" TEXT,
    "analysisAiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "articleStudioModel" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
    "localDominanceModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "brandVoice" TEXT NOT NULL DEFAULT '',
    "costAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedProjectIds" JSONB NOT NULL DEFAULT '[]',
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dataForSeoLogin" TEXT,
    "dataForSeoPassword" TEXT,
    "googleSearchConsoleConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleAnalyticsConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleBusinessProfileConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleBusinessProfileAccessToken" TEXT,
    "googleBusinessProfileRefreshToken" TEXT,
    "googleBusinessProfileTokenExpiry" TIMESTAMP(3),
    "googleBusinessProfileLocationId" TEXT,
    "googleBusinessProfileCid" TEXT,
    "wordpressSiteUrl" TEXT,
    "wordpressUsername" TEXT,
    "wordpressAppPassword" TEXT,
    "webhookUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiloProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "integrationId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "domain" TEXT,
    "seedKeyword" TEXT,
    "geography" TEXT,
    "niche" TEXT,
    "semanticGaps" JSONB,
    "keywordsAnalyzed" INTEGER,
    "rankedKeywords" JSONB,
    "hubGroups" JSONB,
    "importedFromTopicalMapId" TEXT,
    "metricsStatus" TEXT,
    "metricsEnrichedAt" TIMESTAMP(3),
    "metricsCompleteCount" INTEGER,
    "metricsTotalCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiloProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiloNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "originalTargetKeyword" TEXT,
    "keywordSource" TEXT,
    "metricsConfidence" TEXT,
    "searchVolume" INTEGER,
    "difficulty" INTEGER,
    "enrichedAt" TIMESTAMP(3),
    "intent" TEXT,
    "summary" TEXT,
    "funnelStage" TEXT,
    "anchorTextToPillar" TEXT,
    "lateralLinks" JSONB,
    "semanticEntities" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "parentId" TEXT,
    "content" TEXT,
    "slug" TEXT,
    "wpPostId" INTEGER,
    "wpPostStatus" TEXT,
    "articleStudioHistoryId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiloNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "category" TEXT,
    "action" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "details" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "primaryLlmModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "fallbackLlmModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "inputTokenCostPerMillion" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "outputTokenCostPerMillion" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "articleStudioPrompt" TEXT NOT NULL DEFAULT '',
    "dataForSeoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wordpressWebhooksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openaiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geminiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dataForSeoCacheTtlHours" INTEGER NOT NULL DEFAULT 48,
    "queueModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "globalConcurrencyDelayMs" INTEGER NOT NULL DEFAULT 0,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "masterOpenaiKey" TEXT,
    "masterAnthropicKey" TEXT,
    "masterGeminiKey" TEXT,
    "masterDataForSeoLogin" TEXT,
    "masterDataForSeoPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundQueueTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "BackgroundQueueTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationHealthLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "integrationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "latencyMs" INTEGER,
    "targetUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAdjustmentIdempotency" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditAdjustmentIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAuditHistory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "centralLat" DOUBLE PRECISION NOT NULL,
    "centralLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'google',
    "businessName" TEXT,
    "businessCid" TEXT,
    "solvScore" DOUBLE PRECISION,
    "saivScore" DOUBLE PRECISION,
    "gridResults" JSONB NOT NULL,
    "aiVisibility" JSONB,
    "perplexityRecs" JSONB,
    "gbpMetrics" JSONB,
    "spamRadar" JSONB,
    "competitorShifts" JSONB,
    "trendData" JSONB,
    "scheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAuditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL DEFAULT 'GEOGRID',
    "keyword" TEXT NOT NULL,
    "centralLat" DOUBLE PRECISION NOT NULL,
    "centralLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'google',
    "businessName" TEXT,
    "businessCid" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastSolvScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedGapArticle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "jsonLd" JSONB NOT NULL,
    "cluster" TEXT,
    "geoLabel" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedGapArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientShareLink" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainProfileManifest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "draftManifest" JSONB,
    "draftManifestVersion" INTEGER NOT NULL DEFAULT 0,
    "draftUpdatedAt" TIMESTAMP(3),
    "manifestStatus" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'Organization',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainProfileManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAreaPageJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coreService" TEXT NOT NULL,
    "targetCity" TEXT NOT NULL,
    "clientCid" TEXT,
    "centralLat" DOUBLE PRECISION,
    "centralLng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "llmModel" TEXT,
    "htmlContent" TEXT,
    "jsonLdSchema" JSONB,
    "wordpressPostId" INTEGER,
    "wordpressPostUrl" TEXT,
    "gbpPostId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceAreaPageJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_briefId_key" ON "Article"("briefId");

-- CreateIndex
CREATE INDEX "TopicalMap_workspaceId_createdAt_idx" ON "TopicalMap"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TopicalMap_workspaceId_source_createdAt_idx" ON "TopicalMap"("workspaceId", "source", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClusterNode_mapId_idx" ON "ClusterNode"("mapId");

-- CreateIndex
CREATE INDEX "RankTrackerHistory_savedKeywordId_checkedAt_idx" ON "RankTrackerHistory"("savedKeywordId", "checkedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KeywordCache_queryKey_key" ON "KeywordCache"("queryKey");

-- CreateIndex
CREATE INDEX "KeywordCache_expiresAt_idx" ON "KeywordCache"("expiresAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_suspended_idx" ON "VisibilityPrompt"("projectId", "suspended");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_updatedAt_idx" ON "VisibilityPrompt"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "VisibilityPrompt_projectId_sortOrder_idx" ON "VisibilityPrompt"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityPrompt_projectId_prompt_key" ON "VisibilityPrompt"("projectId", "prompt");

-- CreateIndex
CREATE UNIQUE INDEX "AeoBrandProfile_projectId_key" ON "AeoBrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "AeoBrandProfile_projectId_idx" ON "AeoBrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "SavedKeyword_projectId_idx" ON "SavedKeyword"("projectId");

-- CreateIndex
CREATE INDEX "SavedKeyword_workspaceId_currentRank_idx" ON "SavedKeyword"("workspaceId", "currentRank");

-- CreateIndex
CREATE INDEX "SavedKeyword_workspaceId_projectId_idx" ON "SavedKeyword"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "SavedKeyword_workspaceId_isActive_nextCheckAt_idx" ON "SavedKeyword"("workspaceId", "isActive", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedKeyword_projectId_keyword_location_language_searchEngi_key" ON "SavedKeyword"("projectId", "keyword", "location", "language", "searchEngine", "device");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSettings_workspaceId_key" ON "WorkspaceSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceSettings_workspaceId_idx" ON "WorkspaceSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_workspaceId_key" ON "AiConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "AiConfig_workspaceId_idx" ON "AiConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "TeamMember_workspaceId_idx" ON "TeamMember"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_workspaceId_email_key" ON "TeamMember"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_workspaceId_key" ON "IntegrationConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "IntegrationConfig_workspaceId_idx" ON "IntegrationConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SiloProject_importedFromTopicalMapId_key" ON "SiloProject"("importedFromTopicalMapId");

-- CreateIndex
CREATE INDEX "SiloProject_userId_idx" ON "SiloProject"("userId");

-- CreateIndex
CREATE INDEX "SiloProject_workspaceId_createdAt_idx" ON "SiloProject"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SiloNode_projectId_idx" ON "SiloNode"("projectId");

-- CreateIndex
CREATE INDEX "SiloNode_parentId_idx" ON "SiloNode"("parentId");

-- CreateIndex
CREATE INDEX "SiloNode_status_idx" ON "SiloNode"("status");

-- CreateIndex
CREATE INDEX "AuditLogEntry_workspaceId_createdAt_idx" ON "AuditLogEntry"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLogEntry_workspaceId_projectId_createdAt_idx" ON "AuditLogEntry"("workspaceId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLogEntry_workspaceId_category_createdAt_idx" ON "AuditLogEntry"("workspaceId", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_actionType_createdAt_idx" ON "AdminAuditLog"("actionType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BackgroundQueueTask_state_startedAt_idx" ON "BackgroundQueueTask"("state", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "BackgroundQueueTask_userId_idx" ON "BackgroundQueueTask"("userId");

-- CreateIndex
CREATE INDEX "IntegrationHealthLog_integrationType_createdAt_idx" ON "IntegrationHealthLog"("integrationType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IntegrationHealthLog_status_createdAt_idx" ON "IntegrationHealthLog"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditAdjustmentIdempotency_adminId_userId_idx" ON "CreditAdjustmentIdempotency"("adminId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuditHistory_shareToken_key" ON "LocalAuditHistory"("shareToken");

-- CreateIndex
CREATE INDEX "LocalAuditHistory_workspaceId_createdAt_idx" ON "LocalAuditHistory"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LocalAuditHistory_projectId_createdAt_idx" ON "LocalAuditHistory"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LocalAuditHistory_workspaceId_projectId_idx" ON "LocalAuditHistory"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "CronSchedule_workspaceId_isActive_idx" ON "CronSchedule"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "CronSchedule_projectId_isActive_idx" ON "CronSchedule"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "CronSchedule_isActive_nextRunAt_idx" ON "CronSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "PublishedGapArticle_workspaceId_idx" ON "PublishedGapArticle"("workspaceId");

-- CreateIndex
CREATE INDEX "PublishedGapArticle_projectId_idx" ON "PublishedGapArticle"("projectId");

-- CreateIndex
CREATE INDEX "PublishedGapArticle_projectId_cluster_idx" ON "PublishedGapArticle"("projectId", "cluster");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedGapArticle_projectId_slug_key" ON "PublishedGapArticle"("projectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClientShareLink_shareToken_key" ON "ClientShareLink"("shareToken");

-- CreateIndex
CREATE INDEX "ClientShareLink_workspaceId_idx" ON "ClientShareLink"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientShareLink_projectId_idx" ON "ClientShareLink"("projectId");

-- CreateIndex
CREATE INDEX "ClientShareLink_reportType_idx" ON "ClientShareLink"("reportType");

-- CreateIndex
CREATE UNIQUE INDEX "DomainProfileManifest_projectId_key" ON "DomainProfileManifest"("projectId");

-- CreateIndex
CREATE INDEX "DomainProfileManifest_projectId_idx" ON "DomainProfileManifest"("projectId");

-- CreateIndex
CREATE INDEX "DomainProfileManifest_manifestStatus_idx" ON "DomainProfileManifest"("manifestStatus");

-- CreateIndex
CREATE INDEX "ServiceAreaPageJob_workspaceId_status_idx" ON "ServiceAreaPageJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ServiceAreaPageJob_status_createdAt_idx" ON "ServiceAreaPageJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterNode" ADD CONSTRAINT "ClusterNode_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "TopicalMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankTrackerHistory" ADD CONSTRAINT "RankTrackerHistory_savedKeywordId_fkey" FOREIGN KEY ("savedKeywordId") REFERENCES "SavedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityPrompt" ADD CONSTRAINT "VisibilityPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoBrandProfile" ADD CONSTRAINT "AeoBrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedKeyword" ADD CONSTRAINT "SavedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloProject" ADD CONSTRAINT "SiloProject_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "IntegrationConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloNode" ADD CONSTRAINT "SiloNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiloProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloNode" ADD CONSTRAINT "SiloNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SiloNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAuditHistory" ADD CONSTRAINT "LocalAuditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronSchedule" ADD CONSTRAINT "CronSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedGapArticle" ADD CONSTRAINT "PublishedGapArticle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShareLink" ADD CONSTRAINT "ClientShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainProfileManifest" ADD CONSTRAINT "DomainProfileManifest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
