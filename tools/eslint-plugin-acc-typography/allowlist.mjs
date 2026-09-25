/**
 * Paths still using sub-caption sizes (<12px) pending typography Phases 2–3
 * (feature screens / scoring dense UI). Phase 1 shared chrome has been removed.
 *
 * Do NOT add new files here — migrate to TYPE.caption (12) or larger instead.
 *
 * @see apps/mobile/src/theme/typography.ts
 */
export const SUB_CAPTION_ALLOWLIST = [
  'apps/mobile/app/admin/(tabs)/index.tsx',
  'apps/mobile/app/geofence-poc.tsx',
  'apps/mobile/app/matches/[matchId]/index.tsx',
  'apps/mobile/app/matches/[matchId]/playing-xi.tsx',
  'apps/mobile/app/matches/[matchId]/score.tsx',
  'apps/mobile/app/matches/[matchId]/verify-playing-xi.tsx',
  'apps/mobile/app/registrations/[tournamentId]/_impl/players.tsx',
  'apps/mobile/src/components/InningsScorecardView.tsx',
  'apps/mobile/src/components/LiveScorecard.tsx',
  'apps/mobile/src/components/ManOfMatchCard.tsx',
  'apps/mobile/src/components/RatingStats.tsx',
  'apps/mobile/src/components/admin/AdminPasswordResetOtpAnalyticsCard.tsx',
  'apps/mobile/src/components/admin/BroadcastHistoryList.tsx',
  'apps/mobile/src/components/dashboard/PlayingXiSelectionScreen.tsx',
  'apps/mobile/src/components/dashboard/PollPlayingXiConfirmScreen.tsx',
  'apps/mobile/src/components/scoring/**/*.{ts,tsx}',
  'apps/mobile/src/components/stats/PlayerMomMatchListCard.tsx',
  'apps/mobile/src/components/tournament/KnockoutBracketConfirmationHints.tsx',
  'apps/mobile/src/components/tournament/KnockoutBracketManageScreen.tsx',
  'apps/mobile/src/components/tournament/KnockoutChartScreen.tsx',
  'apps/mobile/src/components/tournament/KnockoutManualBracketFill.tsx',
  'apps/mobile/src/components/tournament/StandingsTableStats.tsx',
  'apps/mobile/src/components/tournament/TournamentBoundaryLeaderboardSection.tsx',
  'apps/mobile/src/components/tournament/TournamentGroupCard.tsx',
  'apps/mobile/src/components/tournament/TournamentRegistrationFormScreen.tsx',
  'apps/mobile/src/components/tournament/verify-players/VerifyNotRegisteredCard.tsx',
  'apps/mobile/src/components/tournament/verify-players/VerifyPlayerRatingsRow.tsx',
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
