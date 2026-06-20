-- AlterEnum
ALTER TYPE "DeliveryType" ADD VALUE 'END_INNINGS';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "penaltyBeneficiaryTeamId" TEXT;
