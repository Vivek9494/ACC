-- Soft-delete columns on Tournament — rows and relations are never hard-deleted.
ALTER TABLE "Tournament" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Tournament_isDeleted_idx" ON "Tournament"("isDeleted");
