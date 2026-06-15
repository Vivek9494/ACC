-- Collapse self/adjusted rating columns back to a single field per skill.

ALTER TABLE "Registration" DROP COLUMN IF EXISTS "battingRatingAdjusted";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "bowlingRatingAdjusted";
ALTER TABLE "Registration" DROP COLUMN IF EXISTS "fieldingRatingAdjusted";

ALTER TABLE "Registration" RENAME COLUMN "battingRatingSelf" TO "battingRating";
ALTER TABLE "Registration" RENAME COLUMN "bowlingRatingSelf" TO "bowlingRating";
ALTER TABLE "Registration" RENAME COLUMN "fieldingRatingSelf" TO "fieldingRating";
