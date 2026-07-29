-- Add Schema.org entity type to client brand profiles.

ALTER TABLE "AeoBrandProfile" ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'Organization';
