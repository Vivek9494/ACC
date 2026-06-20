-- Player showcase video metadata (§19).
ALTER TABLE "PlayerVideo" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "PlayerVideo" ADD COLUMN "sizeBytes" INTEGER;
ALTER TABLE "PlayerVideo" ADD COLUMN "storageKey" TEXT;
