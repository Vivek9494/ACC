-- CreateTable
CREATE TABLE "TournamentTypeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "ballType" "BallType" NOT NULL,
    "formatConfig" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTypeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTypeDefinitionCenter" (
    "tournamentTypeDefinitionId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,

    CONSTRAINT "TournamentTypeDefinitionCenter_pkey" PRIMARY KEY ("tournamentTypeDefinitionId","centerId")
);

-- CreateIndex
CREATE INDEX "TournamentTypeDefinition_provinceId_idx" ON "TournamentTypeDefinition"("provinceId");

-- CreateIndex
CREATE INDEX "TournamentTypeDefinition_code_idx" ON "TournamentTypeDefinition"("code");

-- CreateIndex
CREATE INDEX "TournamentTypeDefinition_isDeleted_idx" ON "TournamentTypeDefinition"("isDeleted");

-- CreateIndex
CREATE INDEX "TournamentTypeDefinitionCenter_centerId_idx" ON "TournamentTypeDefinitionCenter"("centerId");

-- AddForeignKey
ALTER TABLE "TournamentTypeDefinition" ADD CONSTRAINT "TournamentTypeDefinition_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTypeDefinitionCenter" ADD CONSTRAINT "TournamentTypeDefinitionCenter_tournamentTypeDefinitionId_fkey" FOREIGN KEY ("tournamentTypeDefinitionId") REFERENCES "TournamentTypeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTypeDefinitionCenter" ADD CONSTRAINT "TournamentTypeDefinitionCenter_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
