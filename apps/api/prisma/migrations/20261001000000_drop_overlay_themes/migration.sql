-- DropForeignKey
ALTER TABLE "OverlayTheme" DROP CONSTRAINT "OverlayTheme_createdById_fkey";

-- DropForeignKey
ALTER TABLE "OverlayThemeGraphic" DROP CONSTRAINT "OverlayThemeGraphic_themeId_fkey";

-- DropForeignKey
ALTER TABLE "OverlayThemeGraphic" DROP CONSTRAINT "OverlayThemeGraphic_uploadedById_fkey";

-- DropTable
DROP TABLE "OverlayTheme";

-- DropTable
DROP TABLE "OverlayThemeGraphic";
