-- Internal-only flag for Admin historical backfill (never exposed in MatchDetail/UI).
ALTER TABLE "Match" ADD COLUMN "suppressLiveSideEffects" BOOLEAN NOT NULL DEFAULT false;
