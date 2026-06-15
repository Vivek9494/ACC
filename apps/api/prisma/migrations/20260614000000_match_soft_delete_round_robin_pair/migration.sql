-- Match soft-delete + round-robin pair key for duplicate-fixture guard.
ALTER TABLE "Match" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Match" ADD COLUMN "roundRobinPairKey" TEXT;

CREATE INDEX "Match_isDeleted_idx" ON "Match"("isDeleted");
CREATE INDEX "Match_tournamentId_roundRobinPairKey_idx" ON "Match"("tournamentId", "roundRobinPairKey");

-- One active round-robin fixture per unordered team pair per tournament (race-safe).
CREATE UNIQUE INDEX "Match_tournamentId_roundRobinPairKey_active_key"
ON "Match" ("tournamentId", "roundRobinPairKey")
WHERE "isDeleted" = false AND "roundRobinPairKey" IS NOT NULL;
