-- Pre-scoring setup: opening batters and bowler chosen at match start (§11).

ALTER TABLE "Match" ADD COLUMN "openingStrikerUserId" TEXT;
ALTER TABLE "Match" ADD COLUMN "openingNonStrikerUserId" TEXT;
ALTER TABLE "Match" ADD COLUMN "openingBowlerUserId" TEXT;
