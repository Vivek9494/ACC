-- Two-sided scorecard confirmation (§13.1): per-team + admin override.

ALTER TABLE "Match"
  ADD COLUMN "homeTeamConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "homeTeamConfirmedByUserId" TEXT,
  ADD COLUMN "homeTeamConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "awayTeamConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "awayTeamConfirmedByUserId" TEXT,
  ADD COLUMN "awayTeamConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "adminConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adminConfirmedByUserId" TEXT,
  ADD COLUMN "adminConfirmedAt" TIMESTAMP(3);

-- Already-locked scorecards count as both sides confirmed.
UPDATE "Match"
SET
  "homeTeamConfirmed" = true,
  "awayTeamConfirmed" = true
WHERE "state" = 'SCORECARD_LOCKED';
