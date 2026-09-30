-- CreateTable
CREATE TABLE "OverlayTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverlayTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverlayThemeGraphic" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "controlKey" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverlayThemeGraphic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OverlayTheme_name_key" ON "OverlayTheme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OverlayThemeGraphic_themeId_controlKey_key" ON "OverlayThemeGraphic"("themeId", "controlKey");

-- AddForeignKey
ALTER TABLE "OverlayTheme" ADD CONSTRAINT "OverlayTheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverlayThemeGraphic" ADD CONSTRAINT "OverlayThemeGraphic_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "OverlayTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverlayThemeGraphic" ADD CONSTRAINT "OverlayThemeGraphic_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

