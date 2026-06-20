-- CreateEnum
CREATE TYPE "RegistrationPlayerType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "playerType" "RegistrationPlayerType";
