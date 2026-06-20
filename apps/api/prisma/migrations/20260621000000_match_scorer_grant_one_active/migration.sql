-- One active (non-revoked) scorer grant per match (§11.1 race-safe assign).
CREATE UNIQUE INDEX "MatchScorerGrant_one_active_per_match_idx"
  ON "MatchScorerGrant"("matchId")
  WHERE "revokedAt" IS NULL;
