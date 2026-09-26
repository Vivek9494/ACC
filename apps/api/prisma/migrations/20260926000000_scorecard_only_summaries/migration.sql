-- Scorecard-only backfill: scoring mode + summary figure tables.

CREATE TYPE "ScoringMode" AS ENUM ('LIVE', 'SCORECARD_ONLY');

ALTER TABLE "Match" ADD COLUMN "scoringMode" "ScoringMode" NOT NULL DEFAULT 'LIVE';

CREATE INDEX "Match_scoringMode_idx" ON "Match"("scoringMode");

CREATE TABLE "ScorecardInningsSummary" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "inningsType" "InningsType" NOT NULL DEFAULT 'NORMAL',
    "battingTeamId" TEXT,
    "bowlingTeamId" TEXT,
    "battingIsExternal" BOOLEAN NOT NULL DEFAULT false,
    "bowlingIsExternal" BOOLEAN NOT NULL DEFAULT false,
    "runs" INTEGER NOT NULL,
    "wickets" INTEGER NOT NULL,
    "legalBalls" INTEGER NOT NULL,
    "oversText" TEXT NOT NULL,
    "oversAllotted" INTEGER,
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "closeReason" TEXT,
    "target" INTEGER,
    "extrasWides" INTEGER NOT NULL DEFAULT 0,
    "extrasNoBalls" INTEGER NOT NULL DEFAULT 0,
    "extrasByes" INTEGER NOT NULL DEFAULT 0,
    "extrasLegByes" INTEGER NOT NULL DEFAULT 0,
    "extrasPenalties" INTEGER NOT NULL DEFAULT 0,
    "extrasTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardInningsSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScorecardBatterSummary" (
    "id" TEXT NOT NULL,
    "inningsSummaryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playerId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "isOut" BOOLEAN NOT NULL,
    "dismissalType" "DismissalType",
    "bowlerId" TEXT,
    "fielderId" TEXT,
    "fielder2Id" TEXT,
    "retiredHurt" BOOLEAN NOT NULL DEFAULT false,
    "isMankad" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScorecardBatterSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScorecardBowlerSummary" (
    "id" TEXT NOT NULL,
    "inningsSummaryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playerId" TEXT NOT NULL,
    "legalBalls" INTEGER NOT NULL,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL,
    "wickets" INTEGER NOT NULL,
    "wides" INTEGER NOT NULL DEFAULT 0,
    "noBalls" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "dotBalls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScorecardBowlerSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScorecardFallOfWicket" (
    "id" TEXT NOT NULL,
    "inningsSummaryId" TEXT NOT NULL,
    "wicketNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamRuns" INTEGER NOT NULL,
    "oversText" TEXT NOT NULL,

    CONSTRAINT "ScorecardFallOfWicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScorecardInningsSummary_matchId_sequence_key" ON "ScorecardInningsSummary"("matchId", "sequence");
CREATE INDEX "ScorecardInningsSummary_matchId_idx" ON "ScorecardInningsSummary"("matchId");
CREATE INDEX "ScorecardBatterSummary_inningsSummaryId_idx" ON "ScorecardBatterSummary"("inningsSummaryId");
CREATE INDEX "ScorecardBatterSummary_playerId_idx" ON "ScorecardBatterSummary"("playerId");
CREATE INDEX "ScorecardBowlerSummary_inningsSummaryId_idx" ON "ScorecardBowlerSummary"("inningsSummaryId");
CREATE INDEX "ScorecardBowlerSummary_playerId_idx" ON "ScorecardBowlerSummary"("playerId");
CREATE INDEX "ScorecardFallOfWicket_inningsSummaryId_idx" ON "ScorecardFallOfWicket"("inningsSummaryId");

ALTER TABLE "ScorecardInningsSummary" ADD CONSTRAINT "ScorecardInningsSummary_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardBatterSummary" ADD CONSTRAINT "ScorecardBatterSummary_inningsSummaryId_fkey" FOREIGN KEY ("inningsSummaryId") REFERENCES "ScorecardInningsSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardBowlerSummary" ADD CONSTRAINT "ScorecardBowlerSummary_inningsSummaryId_fkey" FOREIGN KEY ("inningsSummaryId") REFERENCES "ScorecardInningsSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardFallOfWicket" ADD CONSTRAINT "ScorecardFallOfWicket_inningsSummaryId_fkey" FOREIGN KEY ("inningsSummaryId") REFERENCES "ScorecardInningsSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
