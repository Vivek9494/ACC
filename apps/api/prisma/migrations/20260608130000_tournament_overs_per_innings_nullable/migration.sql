-- Allow tournaments to be created without overs; match setup sets per-match overs later.
ALTER TABLE "Tournament" ALTER COLUMN "oversPerInnings" DROP NOT NULL;
