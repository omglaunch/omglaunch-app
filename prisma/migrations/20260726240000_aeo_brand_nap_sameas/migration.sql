-- Add NAP + sameAs fields to client brand profiles.

ALTER TABLE "AeoBrandProfile" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "AeoBrandProfile" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "AeoBrandProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "AeoBrandProfile" ADD COLUMN "sameAsUrls" TEXT NOT NULL DEFAULT '[]';
