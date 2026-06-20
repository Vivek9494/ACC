-- CreateEnum
CREATE TYPE "LateArrivalPenaltyState" AS ENUM ('OWED', 'ASSIGNED', 'DISCHARGED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LateArrivalPenalty" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "originMatchId" TEXT NOT NULL,
    "state" "LateArrivalPenaltyState" NOT NULL,
    "assignedServeMatchId" TEXT,
    "dischargedAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LateArrivalPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateArrivalPenaltyTransition" (
    "id" TEXT NOT NULL,
    "penaltyId" TEXT NOT NULL,
    "fromState" "LateArrivalPenaltyState",
    "toState" "LateArrivalPenaltyState" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "contextMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LateArrivalPenaltyTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LateArrivalPenalty_playerId_idx" ON "LateArrivalPenalty"("playerId");

-- CreateIndex
CREATE INDEX "LateArrivalPenalty_teamId_idx" ON "LateArrivalPenalty"("teamId");

-- CreateIndex
CREATE INDEX "LateArrivalPenalty_tournamentId_idx" ON "LateArrivalPenalty"("tournamentId");

-- CreateIndex
CREATE INDEX "LateArrivalPenalty_state_idx" ON "LateArrivalPenalty"("state");

-- CreateIndex
CREATE INDEX "LateArrivalPenalty_assignedServeMatchId_idx" ON "LateArrivalPenalty"("assignedServeMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "LateArrivalPenalty_one_active_per_player" ON "LateArrivalPenalty"("playerId") WHERE "state" IN ('OWED', 'ASSIGNED');

-- CreateIndex
CREATE INDEX "LateArrivalPenaltyTransition_penaltyId_idx" ON "LateArrivalPenaltyTransition"("penaltyId");

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_originMatchId_fkey" FOREIGN KEY ("originMatchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_assignedServeMatchId_fkey" FOREIGN KEY ("assignedServeMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenalty" ADD CONSTRAINT "LateArrivalPenalty_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenaltyTransition" ADD CONSTRAINT "LateArrivalPenaltyTransition_penaltyId_fkey" FOREIGN KEY ("penaltyId") REFERENCES "LateArrivalPenalty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateArrivalPenaltyTransition" ADD CONSTRAINT "LateArrivalPenaltyTransition_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
