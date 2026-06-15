-- CreateEnum
CREATE TYPE "PlayerRegistrationRole" AS ENUM ('BATSMAN', 'BOWLER', 'ALL_ROUNDER');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "battingPosition" TEXT,
ADD COLUMN "playerRole" "PlayerRegistrationRole",
ADD COLUMN "bowlingType" TEXT;
