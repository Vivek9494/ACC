/*
  Warnings:

  - You are about to drop the `MatchScorer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MatchScorer" DROP CONSTRAINT "MatchScorer_matchId_fkey";

-- DropTable
DROP TABLE "MatchScorer";

-- CreateTable
CREATE TABLE "MatchScorerGrant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MatchScorerGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchScorerGrant_matchId_idx" ON "MatchScorerGrant"("matchId");

-- CreateIndex
CREATE INDEX "MatchScorerGrant_userId_idx" ON "MatchScorerGrant"("userId");

-- AddForeignKey
ALTER TABLE "MatchScorerGrant" ADD CONSTRAINT "MatchScorerGrant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
