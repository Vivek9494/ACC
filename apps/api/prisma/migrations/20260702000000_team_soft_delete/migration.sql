-- Team soft-delete — archive teams without removing match history rows.
ALTER TABLE "Team" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Team_tournamentId_deletedAt_idx" ON "Team"("tournamentId", "deletedAt");
