-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('ACC', 'APL', 'CENTER');

-- CreateEnum
CREATE TYPE "BallType" AS ENUM ('LEATHER', 'TENNIS');

-- CreateEnum
CREATE TYPE "TournamentState" AS ENUM ('NEW', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'TEAMS_FINALIZED', 'FIXTURE_PUBLISHED', 'LIVE', 'KNOCKOUT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('LEAGUE_SINGLE_ROUND_ROBIN', 'LEAGUE_DOUBLE_ROUND_ROBIN', 'KNOCKOUT_SINGLE_ELIMINATION', 'KNOCKOUT_SEEDED', 'KNOCKOUT_DOUBLE_ELIMINATION', 'GROUP_STAGE_KNOCKOUT', 'SWISS', 'LADDER_CHALLENGE', 'POOL');

-- CreateEnum
CREATE TYPE "MatchState" AS ENUM ('SCHEDULED', 'PLAYING_XI_LOCKED', 'TOSS_COMPLETED', 'LIVE', 'DELAYED', 'RAIN_INTERRUPTED', 'CANCELLED', 'NO_RESULT', 'COMPLETED', 'SCORECARD_LOCKED');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('TEAM_A', 'TEAM_B');

-- CreateEnum
CREATE TYPE "HomeAway" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "TossDecision" AS ENUM ('BAT', 'BOWL');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('IN_WAITLIST', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "BattingStyle" AS ENUM ('RHB', 'LHB');

-- CreateEnum
CREATE TYPE "BowlingStyle" AS ENUM ('PACE', 'SPIN');

-- CreateEnum
CREATE TYPE "PlayerCategory" AS ENUM ('FULLTIME', 'PARTTIME');

-- CreateEnum
CREATE TYPE "SuspensionStatus" AS ENUM ('PENDING', 'SERVED', 'CARRIED_FORWARD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "InningsType" AS ENUM ('NORMAL', 'SUPER_OVER');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('LEGAL', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY_RUNS', 'RETIRED_HURT', 'RETIRED_OUT', 'IMPACT_PLAYER_IN');

-- CreateEnum
CREATE TYPE "DismissalType" AS ENUM ('BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED_OUT');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorLabel" TEXT,
ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "targetEntityId" TEXT,
ADD COLUMN     "targetEntityType" TEXT,
ALTER COLUMN "actorUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "centerId" TEXT,
    "tournamentId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "posterUrl" TEXT,
    "oversPerInnings" INTEGER NOT NULL,
    "maxOversPerBowler" INTEGER NOT NULL,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "registrationOpenAt" TIMESTAMP(3),
    "registrationCloseAt" TIMESTAMP(3),
    "ballType" "BallType" NOT NULL,
    "type" "TournamentType" NOT NULL,
    "state" "TournamentState" NOT NULL DEFAULT 'NEW',
    "format" "TournamentFormat" NOT NULL,
    "impactPlayerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoRequired" BOOLEAN NOT NULL DEFAULT false,
    "videoUploadEndDate" TIMESTAMP(3),
    "youtubeUrl" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentCenter" (
    "tournamentId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,

    CONSTRAINT "TournamentCenter_pkey" PRIMARY KEY ("tournamentId","centerId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerCategory" "PlayerCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'IN_WAITLIST',
    "battingStyle" "BattingStyle",
    "battingRating" INTEGER,
    "bowlingStyle" "BowlingStyle",
    "bowlingRating" INTEGER,
    "fieldingRating" INTEGER,
    "fieldingPosition" TEXT,
    "availabilityNote" TEXT,
    "customFields" JSONB,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchCode" TEXT,
    "state" "MatchState" NOT NULL DEFAULT 'SCHEDULED',
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "externalOpponentName" TEXT,
    "division" TEXT,
    "homeAway" "HomeAway",
    "groundLocation" TEXT,
    "geofenceLat" DOUBLE PRECISION,
    "geofenceLng" DOUBLE PRECISION,
    "matchDate" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "reportingTime" TIMESTAMP(3),
    "tossWinner" "MatchSide",
    "tossDecision" "TossDecision",
    "youtubeUrl" TEXT,
    "originalTarget" INTEGER,
    "dlsTarget" INTEGER,
    "isNoResult" BOOLEAN NOT NULL DEFAULT false,
    "winningTeamId" TEXT,
    "manOfTheMatchUserId" TEXT,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScorer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MatchScorer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExternalPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Innings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "inningsType" "InningsType" NOT NULL DEFAULT 'NORMAL',
    "battingTeamId" TEXT,
    "bowlingTeamId" TEXT,
    "battingIsExternal" BOOLEAN NOT NULL DEFAULT false,
    "bowlingIsExternal" BOOLEAN NOT NULL DEFAULT false,
    "oversAllotted" INTEGER,
    "revisedTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "type" "DeliveryType" NOT NULL,
    "overNumber" INTEGER,
    "ballNumber" INTEGER,
    "strikerUserId" TEXT,
    "strikerExternalId" TEXT,
    "nonStrikerUserId" TEXT,
    "nonStrikerExternalId" TEXT,
    "bowlerUserId" TEXT,
    "bowlerExternalId" TEXT,
    "runsBat" INTEGER NOT NULL DEFAULT 0,
    "extraRuns" INTEGER NOT NULL DEFAULT 0,
    "isFreeHit" BOOLEAN NOT NULL DEFAULT false,
    "dismissalType" "DismissalType",
    "dismissedUserId" TEXT,
    "dismissedExternalId" TEXT,
    "fielderUserId" TEXT,
    "fielderExternalId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "supersededByDeliveryId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" "SuspensionStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredByMatchId" TEXT,
    "servingMatchId" TEXT,
    "reason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityPoll" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerVideo" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "recordedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleAssignment_tournamentId_idx" ON "RoleAssignment"("tournamentId");

-- CreateIndex
CREATE INDEX "RoleAssignment_teamId_idx" ON "RoleAssignment"("teamId");

-- CreateIndex
CREATE INDEX "RoleAssignment_centerId_idx" ON "RoleAssignment"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_userId_role_tournamentId_teamId_centerId_key" ON "RoleAssignment"("userId", "role", "tournamentId", "teamId", "centerId");

-- CreateIndex
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");

-- CreateIndex
CREATE INDEX "Tournament_state_idx" ON "Tournament"("state");

-- CreateIndex
CREATE INDEX "TournamentCenter_centerId_idx" ON "TournamentCenter"("centerId");

-- CreateIndex
CREATE INDEX "Team_tournamentId_idx" ON "Team"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tournamentId_name_key" ON "Team"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_tournamentId_userId_key" ON "TeamMembership"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "Registration_centerId_idx" ON "Registration"("centerId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_tournamentId_userId_key" ON "Registration"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_state_idx" ON "Match"("state");

-- CreateIndex
CREATE INDEX "MatchScorer_matchId_idx" ON "MatchScorer"("matchId");

-- CreateIndex
CREATE INDEX "MatchScorer_userId_idx" ON "MatchScorer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPlayer_matchId_slot_key" ON "ExternalPlayer"("matchId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Innings_matchId_sequence_key" ON "Innings"("matchId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_supersededByDeliveryId_key" ON "Delivery"("supersededByDeliveryId");

-- CreateIndex
CREATE INDEX "Delivery_inningsId_idx" ON "Delivery"("inningsId");

-- CreateIndex
CREATE INDEX "Delivery_inningsId_overNumber_ballNumber_idx" ON "Delivery"("inningsId", "overNumber", "ballNumber");

-- CreateIndex
CREATE INDEX "Suspension_userId_idx" ON "Suspension"("userId");

-- CreateIndex
CREATE INDEX "Suspension_tournamentId_idx" ON "Suspension"("tournamentId");

-- CreateIndex
CREATE INDEX "Suspension_status_idx" ON "Suspension"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityPoll_matchId_key" ON "AvailabilityPoll"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_userId_key" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerVideo_tournamentId_userId_key" ON "PlayerVideo"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "Fee_teamId_idx" ON "Fee"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Fee_tournamentId_userId_key" ON "Fee"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_targetEntityType_targetEntityId_idx" ON "AuditLog"("targetEntityType", "targetEntityId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentCenter" ADD CONSTRAINT "TournamentCenter_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentCenter" ADD CONSTRAINT "TournamentCenter_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorer" ADD CONSTRAINT "MatchScorer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPlayer" ADD CONSTRAINT "ExternalPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Innings" ADD CONSTRAINT "Innings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "Innings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_supersededByDeliveryId_fkey" FOREIGN KEY ("supersededByDeliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityPoll" ADD CONSTRAINT "AvailabilityPoll_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "AvailabilityPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVideo" ADD CONSTRAINT "PlayerVideo_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerVideo" ADD CONSTRAINT "PlayerVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
