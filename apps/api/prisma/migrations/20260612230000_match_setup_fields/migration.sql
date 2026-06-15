-- Per-match setup fields: group, overs quotas (§6.1 at match setup).
ALTER TABLE "Match" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Match" ADD COLUMN "oversPerInnings" INTEGER;
ALTER TABLE "Match" ADD COLUMN "maxOversPerBowler" INTEGER;

CREATE INDEX "Match_groupId_idx" ON "Match"("groupId");

ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
