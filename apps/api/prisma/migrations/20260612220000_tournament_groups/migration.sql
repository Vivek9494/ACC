-- Tournament groups for Group Stage + Knockout scheduling.

CREATE TABLE "TournamentGroup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Team" ADD COLUMN "groupId" TEXT;

CREATE UNIQUE INDEX "TournamentGroup_tournamentId_nameNormalized_key" ON "TournamentGroup"("tournamentId", "nameNormalized");
CREATE INDEX "TournamentGroup_tournamentId_idx" ON "TournamentGroup"("tournamentId");
CREATE INDEX "Team_groupId_idx" ON "Team"("groupId");

ALTER TABLE "TournamentGroup" ADD CONSTRAINT "TournamentGroup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
