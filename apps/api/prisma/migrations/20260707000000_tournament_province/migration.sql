-- Add province categorization to tournaments (backfill from linked centers where available).
ALTER TABLE "Tournament" ADD COLUMN "provinceId" TEXT;

UPDATE "Tournament" t
SET "provinceId" = sub."provinceId"
FROM (
  SELECT DISTINCT ON (tc."tournamentId")
    tc."tournamentId",
    c."provinceId"
  FROM "TournamentCenter" tc
  INNER JOIN "Center" c ON c."id" = tc."centerId"
  ORDER BY tc."tournamentId", c."name" ASC
) AS sub
WHERE t."id" = sub."tournamentId"
  AND t."provinceId" IS NULL;

CREATE INDEX "Tournament_provinceId_idx" ON "Tournament"("provinceId");

ALTER TABLE "Tournament"
  ADD CONSTRAINT "Tournament_provinceId_fkey"
  FOREIGN KEY ("provinceId") REFERENCES "Province"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
