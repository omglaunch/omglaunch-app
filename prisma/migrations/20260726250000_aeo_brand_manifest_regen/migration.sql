-- Track debounced domain manifest regeneration on brand profile changes.

ALTER TABLE "AeoBrandProfile" ADD COLUMN "manifestRegenRequestedAt" DATETIME;
ALTER TABLE "AeoBrandProfile" ADD COLUMN "manifestRegenCompletedAt" DATETIME;
