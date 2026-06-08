/*
  Warnings:

  - Added the required column `sequence` to the `Delivery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "isBoundary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sequence" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "scorecardVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Delivery_inningsId_sequence_idx" ON "Delivery"("inningsId", "sequence");
