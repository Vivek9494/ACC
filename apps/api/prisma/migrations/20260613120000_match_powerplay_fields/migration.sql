-- Per-match powerplay configuration (§31 #2 — match-level, not tournament create).
ALTER TABLE "Match" ADD COLUMN "powerplayOvers" INTEGER;
ALTER TABLE "Match" ADD COLUMN "battingPowerplayOvers" INTEGER;
