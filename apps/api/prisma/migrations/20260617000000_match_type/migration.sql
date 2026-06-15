-- Manual match setup: fixture stage / knockout round (§11).

CREATE TYPE "MatchType" AS ENUM (
  'LEAGUE_MATCH',
  'PRE_QUARTER_FINAL',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL',
  'SUPER_LEAGUE',
  'QUALIFIER_1',
  'QUALIFIER_2',
  'ELIMINATOR',
  'SUPER_EIGHT'
);

ALTER TABLE "Match" ADD COLUMN "matchType" "MatchType" NOT NULL DEFAULT 'LEAGUE_MATCH';
