-- Per-team shared favourites shortlist for verified tennis registrants (Captain + VC).
CREATE TABLE "TeamRegistrationFavourite" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favouritedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRegistrationFavourite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamRegistrationFavourite_tournamentId_teamId_userId_key" ON "TeamRegistrationFavourite"("tournamentId", "teamId", "userId");

CREATE INDEX "TeamRegistrationFavourite_tournamentId_teamId_idx" ON "TeamRegistrationFavourite"("tournamentId", "teamId");

ALTER TABLE "TeamRegistrationFavourite" ADD CONSTRAINT "TeamRegistrationFavourite_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamRegistrationFavourite" ADD CONSTRAINT "TeamRegistrationFavourite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamRegistrationFavourite" ADD CONSTRAINT "TeamRegistrationFavourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
