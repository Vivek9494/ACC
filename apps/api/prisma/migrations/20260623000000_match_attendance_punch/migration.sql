-- CreateEnum
CREATE TYPE "AttendancePunchSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendancePunchStatus" AS ENUM ('ON_TIME', 'LATE');

-- CreateTable
CREATE TABLE "MatchAttendancePunch" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "punchTimeUtc" TIMESTAMP(3) NOT NULL,
    "source" "AttendancePunchSource" NOT NULL,
    "status" "AttendancePunchStatus" NOT NULL,
    "verifiedLate" BOOLEAN NOT NULL DEFAULT false,
    "setByUserId" TEXT,
    "editedFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchAttendancePunch_matchId_teamId_idx" ON "MatchAttendancePunch"("matchId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAttendancePunch_matchId_userId_key" ON "MatchAttendancePunch"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "MatchAttendancePunch" ADD CONSTRAINT "MatchAttendancePunch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAttendancePunch" ADD CONSTRAINT "MatchAttendancePunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAttendancePunch" ADD CONSTRAINT "MatchAttendancePunch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAttendancePunch" ADD CONSTRAINT "MatchAttendancePunch_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
