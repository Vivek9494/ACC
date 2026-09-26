import {
  isExternalOpponentMatch,
  isLiveScoringMode,
  isScorerMatchResumable,
  scorerVerifyPlayingXiButtonLabel,
  unfinalizedTeamForScorerVerify,
  type ScorerStartableMatch,
} from '@acc/types';
import { router as rootRouter, type Router } from 'expo-router';

export function scorerDashboardButtonLabel(match: ScorerStartableMatch): string {
  if (
    isLiveScoringMode(match.scoringMode) &&
    isScorerMatchResumable(match.state, match.hasScoringSession)
  ) {
    return 'Continue Scoring';
  }
  return scorerVerifyPlayingXiButtonLabel({
    homeTeamName: match.teamA.name,
    awayTeamName: match.teamB.name,
    homeTeamFinalized: match.homeTeamFinalized,
    awayTeamFinalized: match.awayTeamFinalized,
    awayTeamId: match.awayTeamId,
  });
}

/**
 * Open the scoring cockpit from a role dashboard.
 * Uses the root Expo Router singleton + the same string href as Match Details
 * Continue Scoring — nested Admin/Captain tab routers on native can no-op when
 * pushing a dynamic pathname object onto a different stack.
 */
function pushScoreCockpit(matchId: string): void {
  rootRouter.push(`/matches/${matchId}/score`);
}

/** Dashboard card tap — verify XI, toss/setup, or live scoring. */
export function handleScorerDashboardPress(
  match: ScorerStartableMatch,
  _router: Router,
  onOpenMatchSetup?: (match: ScorerStartableMatch) => void,
): void {
  if (
    isLiveScoringMode(match.scoringMode) &&
    isScorerMatchResumable(match.state, match.hasScoringSession)
  ) {
    pushScoreCockpit(match.matchId);
    return;
  }
  if (match.bothTeamsFinalized) {
    if (!match.canStartMatch) {
      return;
    }
    if (onOpenMatchSetup) {
      onOpenMatchSetup(match);
      return;
    }
    pushScoreCockpit(match.matchId);
    return;
  }

  const externalOpponent = isExternalOpponentMatch({
    awayTeamId: match.awayTeamId,
    externalOpponentName: match.teamB.name,
  });

  if (!match.homeTeamFinalized && !match.awayTeamFinalized) {
    if (externalOpponent) {
      rootRouter.push(`/matches/${match.matchId}`);
      return;
    }
    rootRouter.push(`/matches/${match.matchId}/verify-playing-xi`);
    return;
  }

  if (externalOpponent && !match.awayTeamFinalized) {
    rootRouter.push(`/matches/${match.matchId}/opponent-players`);
    return;
  }

  const unfinalized = unfinalizedTeamForScorerVerify({
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeamName: match.teamA.name,
    awayTeamName: match.teamB.name,
    homeTeamFinalized: match.homeTeamFinalized,
    awayTeamFinalized: match.awayTeamFinalized,
    bothTeamsFinalized: match.bothTeamsFinalized,
  });

  if (!unfinalized) {
    return;
  }

  rootRouter.push({
    pathname: '/matches/[matchId]/verify-playing-xi',
    params: {
      matchId: match.matchId,
      teamId: unfinalized.teamId,
      teamName: unfinalized.teamName,
    },
  });
}
