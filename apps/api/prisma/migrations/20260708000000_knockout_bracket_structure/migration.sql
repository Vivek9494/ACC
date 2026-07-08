-- Knockout bracket structure on matches + tournament champion.

ALTER TABLE "Tournament" ADD COLUMN "championTeamId" TEXT;

ALTER TABLE "Match" ADD COLUMN "bracketRoundIndex" INTEGER;
ALTER TABLE "Match" ADD COLUMN "bracketPosition" INTEGER;
ALTER TABLE "Match" ADD COLUMN "bracketRoundLabel" TEXT;
ALTER TABLE "Match" ADD COLUMN "nextMatchId" TEXT;
ALTER TABLE "Match" ADD COLUMN "nextMatchSlot" "MatchSide";

CREATE INDEX "Match_tournamentId_bracketRoundIndex_idx" ON "Match"("tournamentId", "bracketRoundIndex");
CREATE INDEX "Match_nextMatchId_idx" ON "Match"("nextMatchId");

ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_championTeamId_fkey"
  FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey"
  FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
