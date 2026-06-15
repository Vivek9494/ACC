-- Rename player self-reported ratings and add Center Sevak adjusted columns (§7.5).
ALTER TABLE "Registration" RENAME COLUMN "battingRating" TO "battingRatingSelf";
ALTER TABLE "Registration" RENAME COLUMN "bowlingRating" TO "bowlingRatingSelf";
ALTER TABLE "Registration" RENAME COLUMN "fieldingRating" TO "fieldingRatingSelf";

ALTER TABLE "Registration" ADD COLUMN "battingRatingAdjusted" INTEGER,
ADD COLUMN "bowlingRatingAdjusted" INTEGER,
ADD COLUMN "fieldingRatingAdjusted" INTEGER;
