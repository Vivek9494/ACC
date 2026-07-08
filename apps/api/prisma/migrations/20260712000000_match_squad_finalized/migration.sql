-- Per-team Playing XI finalization (pre-match verify gate; editable after finalize).
ALTER TABLE "MatchSquad"
  ADD COLUMN "isFinalized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "finalizedByUserId" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3);

ALTER TABLE "MatchSquad"
  ADD CONSTRAINT "MatchSquad_finalizedByUserId_fkey"
  FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
