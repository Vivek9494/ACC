-- Null playersPerTeam means no roster cap per team (Add Tournament field left empty).
ALTER TABLE "Tournament" ALTER COLUMN "playersPerTeam" DROP NOT NULL;
ALTER TABLE "Tournament" ALTER COLUMN "playersPerTeam" DROP DEFAULT;
