-- KnockoutBracket metadata row + match linkage for APL knockout system.

CREATE TABLE "KnockoutBracket" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "bracketSize" INTEGER NOT NULL,
  "byeCount" INTEGER NOT NULL,
  "knockoutTeamCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnockoutBracket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnockoutBracket_tournamentId_key" ON "KnockoutBracket"("tournamentId");
CREATE INDEX "KnockoutBracket_tournamentId_idx" ON "KnockoutBracket"("tournamentId");

ALTER TABLE "KnockoutBracket"
  ADD CONSTRAINT "KnockoutBracket_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match" ADD COLUMN "bracketId" TEXT;
ALTER TABLE "Match" ADD COLUMN "awaitingTeams" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Match_bracketId_idx" ON "Match"("bracketId");

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_bracketId_fkey"
  FOREIGN KEY ("bracketId") REFERENCES "KnockoutBracket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
