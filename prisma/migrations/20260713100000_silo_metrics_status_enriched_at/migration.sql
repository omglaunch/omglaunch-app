-- AlterTable
ALTER TABLE "SiloProject" ADD COLUMN "metricsStatus" TEXT;
ALTER TABLE "SiloProject" ADD COLUMN "metricsEnrichedAt" DATETIME;
ALTER TABLE "SiloProject" ADD COLUMN "metricsCompleteCount" INTEGER;
ALTER TABLE "SiloProject" ADD COLUMN "metricsTotalCount" INTEGER;

-- AlterTable
ALTER TABLE "SiloNode" ADD COLUMN "enrichedAt" DATETIME;
