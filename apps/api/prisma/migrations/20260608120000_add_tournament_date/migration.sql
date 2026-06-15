-- CreateTable
CREATE TABLE "TournamentDate" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentDate_tournamentId_idx" ON "TournamentDate"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentDate_tournamentId_date_key" ON "TournamentDate"("tournamentId", "date");

-- AddForeignKey
ALTER TABLE "TournamentDate" ADD CONSTRAINT "TournamentDate_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one row per calendar day from existing startAt..endAt (inclusive, UTC).
INSERT INTO "TournamentDate" ("id", "tournamentId", "date")
SELECT gen_random_uuid()::text, t."id", gs.day
FROM "Tournament" t
CROSS JOIN LATERAL (
  SELECT generate_series(
    date_trunc('day', t."startAt" AT TIME ZONE 'UTC'),
    date_trunc('day', t."endAt" AT TIME ZONE 'UTC'),
    interval '1 day'
  ) AS day
) gs;
