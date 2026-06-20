-- Scorer-selected at-crease batters and current-over bowler (pre-delivery setup).

ALTER TABLE "Innings" ADD COLUMN "selectedStrikerUserId" TEXT;
ALTER TABLE "Innings" ADD COLUMN "selectedStrikerExternalId" TEXT;
ALTER TABLE "Innings" ADD COLUMN "selectedNonStrikerUserId" TEXT;
ALTER TABLE "Innings" ADD COLUMN "selectedNonStrikerExternalId" TEXT;
ALTER TABLE "Innings" ADD COLUMN "selectedBowlerUserId" TEXT;
ALTER TABLE "Innings" ADD COLUMN "selectedBowlerExternalId" TEXT;
