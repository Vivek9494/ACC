-- Persist venue IANA timezone on tournaments (resolved once from location coordinates).
ALTER TABLE "Tournament" ADD COLUMN "timezone" TEXT;
