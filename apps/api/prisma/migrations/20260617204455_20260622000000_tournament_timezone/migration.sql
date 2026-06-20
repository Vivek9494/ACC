/*
  Warnings:

  - Made the column `teamId` on table `AvailabilityPoll` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AvailabilityPoll" ALTER COLUMN "teamId" SET NOT NULL;
