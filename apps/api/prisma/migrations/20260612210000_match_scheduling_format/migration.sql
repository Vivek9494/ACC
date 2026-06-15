-- Add scheduling-mode field (distinct from TournamentFormat set at create).

CREATE TYPE "MatchSchedulingFormat" AS ENUM ('ROUND_ROBIN', 'GROUP_STAGE_KNOCKOUT', 'MANUAL');

ALTER TABLE "Tournament" ADD COLUMN "matchSchedulingFormat" "MatchSchedulingFormat";
