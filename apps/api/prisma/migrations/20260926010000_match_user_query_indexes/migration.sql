-- Query-shape indexes for tournament match lists, date-range lookups and
-- active-user filters.

-- DropIndex (prefix-covered by the tournamentId composites below/existing)
DROP INDEX "Match_tournamentId_idx";

-- DropIndex (superseded by User_deletedAt_isActive_idx)
DROP INDEX "User_deletedAt_idx";

-- CreateIndex
CREATE INDEX "Match_tournamentId_isDeleted_state_idx" ON "Match"("tournamentId", "isDeleted", "state");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "Match"("matchDate");

-- CreateIndex
CREATE INDEX "User_deletedAt_isActive_idx" ON "User"("deletedAt", "isActive");
