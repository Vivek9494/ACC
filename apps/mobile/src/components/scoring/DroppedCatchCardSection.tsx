import {
  canViewLiveScoringDroppedCatchCard,
  filterDroppedCatchEventsForDisplay,
  type AuthUser,
  type InningsScorecard,
  type MatchDetail,
  type ScorecardResponse,
} from '@acc/types';
import { useMemo } from 'react';

import type { NameResolver } from '../LiveScorecard';
import { LiveScoringDroppedCatchCard } from './LiveScoringDroppedCatchCard';

export interface DroppedCatchCardSectionProps {
  card: ScorecardResponse | null;
  match: Pick<MatchDetail, 'tournamentId' | 'homeTeamId' | 'awayTeamId' | 'ballType'> | null;
  user: AuthUser | null | undefined;
  nameOf: NameResolver;
  /** When set, only drops from this innings are shown (active tab). */
  innings: InningsScorecard | null | undefined;
}

/** Leader-only dropped-catch log — scoped to one innings; hidden when empty. */
export function DroppedCatchCardSection({
  card,
  match,
  user,
  nameOf,
  innings,
}: DroppedCatchCardSectionProps): React.ReactElement | null {
  const visible = useMemo(
    () =>
      Boolean(
        match &&
          user &&
          innings &&
          canViewLiveScoringDroppedCatchCard(user, {
            tournamentId: match.tournamentId,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
          }),
      ),
    [innings, match, user],
  );

  const events = useMemo(
    () =>
      card && match?.ballType && innings
        ? filterDroppedCatchEventsForDisplay(match.ballType, innings)
        : [],
    [card, innings, match?.ballType],
  );

  if (!visible || events.length === 0) {
    return null;
  }

  return <LiveScoringDroppedCatchCard events={events} nameOf={nameOf} />;
}
