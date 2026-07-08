-- Single-record suspension carry-forward audit fields (§10.3).
ALTER TABLE "Suspension" ADD COLUMN "actionedAtMatchId" TEXT;
ALTER TABLE "Suspension" ADD COLUMN "carryForwardCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Suspension_servingMatchId_teamId_status_idx" ON "Suspension"("servingMatchId", "teamId", "status");
CREATE INDEX "Suspension_actionedAtMatchId_idx" ON "Suspension"("actionedAtMatchId");
