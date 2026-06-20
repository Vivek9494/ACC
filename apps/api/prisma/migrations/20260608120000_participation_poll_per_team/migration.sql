-- Per-team participation polls (ACC vs ACC: one poll per system team).

DROP INDEX IF EXISTS "AvailabilityPoll_matchId_key";

ALTER TABLE "AvailabilityPoll" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

ALTER TABLE "AvailabilityPoll"
  ADD CONSTRAINT "AvailabilityPoll_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityPoll_matchId_teamId_key"
  ON "AvailabilityPoll"("matchId", "teamId");

CREATE INDEX IF NOT EXISTS "AvailabilityPoll_teamId_idx" ON "AvailabilityPoll"("teamId");
