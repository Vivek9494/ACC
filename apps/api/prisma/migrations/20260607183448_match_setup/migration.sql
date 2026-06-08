-- CreateEnum
CREATE TYPE "MatchSquadRole" AS ENUM ('PLAYING_XI', 'SUBSTITUTE', 'IMPACT_CANDIDATE');

-- CreateTable
CREATE TABLE "MatchSquad" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSquadPlayer" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MatchSquadRole" NOT NULL,
    "isActiveImpact" BOOLEAN NOT NULL DEFAULT false,
    "battingOrder" INTEGER,

    CONSTRAINT "MatchSquadPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSquad_teamId_idx" ON "MatchSquad"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSquad_matchId_teamId_key" ON "MatchSquad"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchSquadPlayer_userId_idx" ON "MatchSquadPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSquadPlayer_squadId_userId_key" ON "MatchSquadPlayer"("squadId", "userId");

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquadPlayer" ADD CONSTRAINT "MatchSquadPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "MatchSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquadPlayer" ADD CONSTRAINT "MatchSquadPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
