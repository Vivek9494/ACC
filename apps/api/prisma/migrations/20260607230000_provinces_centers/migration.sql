-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Province_name_key" ON "Province"("name");

-- Seed a default province for existing centers
INSERT INTO "Province" ("id", "name", "isActive", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Ontario', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "Center" ADD COLUMN "provinceId" TEXT;
ALTER TABLE "Center" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Center" SET "provinceId" = '00000000-0000-4000-8000-000000000001';

ALTER TABLE "Center" ALTER COLUMN "provinceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Center_provinceId_idx" ON "Center"("provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "Center_provinceId_name_key" ON "Center"("provinceId", "name");

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
