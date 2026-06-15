-- Case-insensitive per-tournament team name uniqueness (tournamentId + lower(trim(name))).

ALTER TABLE "Team" ADD COLUMN "nameNormalized" TEXT;

UPDATE "Team" SET "nameNormalized" = lower(trim("name"));

ALTER TABLE "Team" ALTER COLUMN "nameNormalized" SET NOT NULL;

DROP INDEX "Team_tournamentId_name_key";

CREATE UNIQUE INDEX "Team_tournamentId_nameNormalized_key" ON "Team"("tournamentId", "nameNormalized");
