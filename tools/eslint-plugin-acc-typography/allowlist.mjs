/**
 * Paths still using sub-caption sizes (<12px) pending typography Phase 3
 * (scoring cockpit, live/innings scorecards, standings, knockout brackets).
 *
 * Phases 0–2 (tokens, shared chrome, feature screens) have been removed.
 * Do NOT add new files here — migrate to TYPE.caption (12) or larger instead.
 *
 * @see apps/mobile/src/theme/typography.ts
 */
export const SUB_CAPTION_ALLOWLIST = [
  'apps/mobile/app/matches/[matchId]/score.tsx',
  'apps/mobile/src/components/InningsScorecardView.tsx',
  'apps/mobile/src/components/LiveScorecard.tsx',
  'apps/mobile/src/components/scoring/**/*.{ts,tsx}',
  'apps/mobile/src/components/tournament/KnockoutBracketConfirmationHints.tsx',
  'apps/mobile/src/components/tournament/KnockoutBracketManageScreen.tsx',
  'apps/mobile/src/components/tournament/KnockoutChartScreen.tsx',
  'apps/mobile/src/components/tournament/KnockoutManualBracketFill.tsx',
  'apps/mobile/src/components/tournament/StandingsTableStats.tsx',
];

/** Shared form controls — fontSize must stay ≥16 (iOS focus zoom). */
export const INPUT_COMPONENT_GLOBS = [
  'apps/mobile/src/components/ui/TextInput.tsx',
  'apps/mobile/src/components/ui/DateField.tsx',
  'apps/mobile/src/components/ui/TimeField.tsx',
  'apps/mobile/src/components/ui/Select.tsx',
  'apps/mobile/src/components/ui/MultiSelect.tsx',
  'apps/mobile/src/components/ui/TournamentLocationField.tsx',
  'apps/mobile/src/components/ui/TournamentDatesField.tsx',
];
