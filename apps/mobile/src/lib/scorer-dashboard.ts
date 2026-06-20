import { isScorerMatchResumable, type ScorerStartableMatch } from '@acc/types';
import type { Router } from 'expo-router';

export function scorerDashboardButtonLabel(match: ScorerStartableMatch): string {
  return isScorerMatchResumable(match.state) ? 'Continue Scoring' : 'Start Match';
}

/** Dashboard card tap — toss/setup for pre-live; live scoring screen when in progress. */
export function handleScorerDashboardPress(
  match: ScorerStartableMatch,
  router: Router,
  onOpenMatchSetup?: (match: ScorerStartableMatch) => void,
): void {
  if (isScorerMatchResumable(match.state)) {
    router.push(`/matches/${match.matchId}/score`);
    return;
  }
  if (onOpenMatchSetup) {
    onOpenMatchSetup(match);
    return;
  }
  router.push(`/matches/${match.matchId}/score`);
}
