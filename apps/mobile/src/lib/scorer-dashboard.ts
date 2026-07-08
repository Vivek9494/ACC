import {
  isExternalOpponentMatch,
  isScorerMatchResumable,
  scorerVerifyPlayingXiButtonLabel,
  unfinalizedTeamForScorerVerify,
  type ScorerStartableMatch,
} from '@acc/types';
import type { Router } from 'expo-router';

export function scorerDashboardButtonLabel(match: ScorerStartableMatch): string {
  if (isScorerMatchResumable(match.state, match.hasScoringSession)) {
    return 'Continue Scoring';
  }
  return scorerVerifyPlayingXiButtonLabel(match);
}

/** Dashboard card tap — verify XI, toss/setup, or live scoring. */
export function handleScorerDashboardPress(
  match: ScorerStartableMatch,
  router: Router,
  onOpenMatchSetup?: (match: ScorerStartableMatch) => void,
): void {
  if (isScorerMatchResumable(match.state, match.hasScoringSession)) {
    router.push(`/matches/${match.matchId}/score`);
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
    router.push(`/matches/${match.matchId}/score`);
    return;
  }

  const externalOpponent = isExternalOpponentMatch({
    awayTeamId: match.awayTeamId,
    externalOpponentName: match.teamB.name,
  });

  if (!match.homeTeamFinalized && !match.awayTeamFinalized) {
    if (externalOpponent) {
      router.push(`/matches/${match.matchId}`);
      return;
    }
    router.push(`/matches/${match.matchId}/verify-playing-xi`);
    return;
  }

  if (externalOpponent && !match.awayTeamFinalized) {
    router.push(`/matches/${match.matchId}/opponent-players`);
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

  router.push({
    pathname: '/matches/[matchId]/verify-playing-xi',
    params: {
      matchId: match.matchId,
      teamId: unfinalized.teamId,
      teamName: unfinalized.teamName,
    },
  });
}
