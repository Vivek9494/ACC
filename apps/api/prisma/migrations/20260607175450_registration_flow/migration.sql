-- CreateEnum
CREATE TYPE "RegistrationFieldType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "CustomFormRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'DECLINED');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "isAvailable" BOOLEAN;

-- CreateTable
CREATE TABLE "RegistrationFieldDefinition" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "RegistrationFieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFormRequest" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "requestedFields" JSONB,
    "status" "CustomFormRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFormRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationFieldDefinition_tournamentId_idx" ON "RegistrationFieldDefinition"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFieldDefinition_tournamentId_key_key" ON "RegistrationFieldDefinition"("tournamentId", "key");

-- CreateIndex
CREATE INDEX "CustomFormRequest_tournamentId_idx" ON "CustomFormRequest"("tournamentId");

-- CreateIndex
CREATE INDEX "CustomFormRequest_status_idx" ON "CustomFormRequest"("status");

-- AddForeignKey
ALTER TABLE "RegistrationFieldDefinition" ADD CONSTRAINT "RegistrationFieldDefinition_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFormRequest" ADD CONSTRAINT "CustomFormRequest_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
