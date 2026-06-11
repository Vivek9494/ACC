-- CreateEnum
CREATE TYPE "JerseySize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasHealthCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jerseyName" TEXT,
ADD COLUMN     "jerseySize" "JerseySize";
