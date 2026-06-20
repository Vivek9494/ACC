-- Normalize legacy 0–5 registration ratings to the 0–10 integer scale (multiply by 2).
-- Values already on the 0–10 scale (6–10) are left unchanged.

UPDATE "Registration"
SET "battingRating" = "battingRating" * 2
WHERE "battingRating" IS NOT NULL AND "battingRating" <= 5;

UPDATE "Registration"
SET "bowlingRating" = "bowlingRating" * 2
WHERE "bowlingRating" IS NOT NULL AND "bowlingRating" <= 5;

UPDATE "Registration"
SET "fieldingRating" = "fieldingRating" * 2
WHERE "fieldingRating" IS NOT NULL AND "fieldingRating" <= 5;
