ALTER TABLE "TeamMembership"
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "TeamMembership_teamId_isDeleted_idx"
ON "TeamMembership"("teamId", "isDeleted");

CREATE INDEX "TeamMembership_tournamentId_isDeleted_idx"
ON "TeamMembership"("tournamentId", "isDeleted");
