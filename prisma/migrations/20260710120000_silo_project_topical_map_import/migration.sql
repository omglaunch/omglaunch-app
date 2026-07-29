-- AlterTable
ALTER TABLE "SiloProject" ADD COLUMN "importedFromTopicalMapId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SiloProject_importedFromTopicalMapId_key" ON "SiloProject"("importedFromTopicalMapId");
