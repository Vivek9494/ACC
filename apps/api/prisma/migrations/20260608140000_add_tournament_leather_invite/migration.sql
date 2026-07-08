-- CreateTable
CREATE TABLE "TournamentLeatherInvite" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentLeatherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentLeatherInvite_tournamentId_userId_key" ON "TournamentLeatherInvite"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TournamentLeatherInvite_tournamentId_idx" ON "TournamentLeatherInvite"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentLeatherInvite_userId_idx" ON "TournamentLeatherInvite"("userId");

-- AddForeignKey
ALTER TABLE "TournamentLeatherInvite" ADD CONSTRAINT "TournamentLeatherInvite_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLeatherInvite" ADD CONSTRAINT "TournamentLeatherInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLeatherInvite" ADD CONSTRAINT "TournamentLeatherInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
