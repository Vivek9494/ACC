import {
  type ManOfMatchEligibilityView,
  type MatchDetail,
  type ScorecardConfirmationView,
  type ScorecardResponse,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  ApiRequestError,
  getManOfMatchEligibility,
  getScorecard,
} from '../../lib/api';
import {
  isManOfMatchApplicable,
  shouldOfferManOfMatch,
} from '../../lib/match-completion';
import { useScorecardResolvers } from '../../hooks/useMatchResolvers';
import { ManOfMatchCard } from '../ManOfMatchCard';
import { ManOfMatchActionCard } from '../scoring/ManOfMatchActionCard';
import { Text } from '../ui/Text';

const POST_MATCH_STATES = new Set(['COMPLETED', 'SCORECARD_LOCKED']);

export interface MatchManOfMatchBlockProps {
  matchId: string;
  match: MatchDetail;
  /** When the parent already loaded the scorecard, pass it to skip a fetch. */
  card?: ScorecardResponse | null;
  momEligibility?: ManOfMatchEligibilityView | null;
  confirmation?: ScorecardConfirmationView | null;
  resultLine?: string | null;
  working?: boolean;
  /** Match Detail: inline action button; scorecard: bordered required card. */
  actionStyle?: 'inline' | 'card';
  /** When false, the awarded MoM card is rendered elsewhere (e.g. inside the scorecard body). */
  showAwardedCard?: boolean;
}

/** MoM display + select/change for completed matches (§13.3). */
export function MatchManOfMatchBlock({
  matchId,
  match,
  card: cardProp,
  momEligibility: eligibilityProp,
  confirmation: confirmationProp,
  working: workingProp = false,
  actionStyle = 'card',
  showAwardedCard = true,
}: MatchManOfMatchBlockProps): React.ReactElement | null {
  const router = useRouter();
  const [cardLocal, setCardLocal] = useState<ScorecardResponse | null>(null);
  const [eligibilityLocal, setEligibilityLocal] = useState<ManOfMatchEligibilityView | null>(null);
  const [loading, setLoading] = useState(cardProp === undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const card = cardProp ?? cardLocal;
  const momEligibility = eligibilityProp ?? eligibilityLocal;
  const confirmation = confirmationProp;

  const loadSelf = useCallback(async () => {
    if (cardProp !== undefined) return;
    if (!POST_MATCH_STATES.has(match.state)) {
      setLoading(false);
      return;
    }
    try {
      const [loadedCard, eligibility] = await Promise.all([
        getScorecard(matchId),
        getManOfMatchEligibility(matchId).catch(() => ({
          offered: false,
          canSelect: false,
          required: false,
          dueAt: null,
          overdue: false,
        })),
      ]);
      setCardLocal(loadedCard);
      setEligibilityLocal(eligibility);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load Man of the Match.');
    } finally {
      setLoading(false);
    }
  }, [cardProp, match.state, matchId]);

  useEffect(() => {
    void loadSelf();
  }, [loadSelf]);

  const { nameOf } = useScorecardResolvers(card, match);

  const momUserId =
    match.manOfTheMatchUserId ?? confirmation?.manOfTheMatchUserId ?? null;

  const winningTeamName = useMemo(() => {
    const winnerId = card?.result.winningTeamId ?? match.winningTeamId;
    if (!winnerId) return 'Winning team';
    return (
      match.squads.find((s) => s.teamId === winnerId)?.teamName ??
      (winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName) ??
      'Winning team'
    );
  }, [card?.result.winningTeamId, match]);

  const canSelectMom =
    Boolean(momEligibility?.offered && momEligibility.canSelect) &&
    isManOfMatchApplicable(match, card);
  const momPending = shouldOfferManOfMatch(match, card);
  const momSelected = Boolean(momUserId);

  function openSelectionPage(): void {
    router.push(`/matches/${matchId}/man-of-the-match`);
  }

  if (loading || !isManOfMatchApplicable(match, card)) {
    return loadError ? (
      <View className="rounded-lg bg-primary-50 px-4 py-3">
        <Text className="font-sans text-sm text-primary">{loadError}</Text>
      </View>
    ) : null;
  }

  if (!canSelectMom && !momSelected) {
    return null;
  }

  return (
    <View className="gap-4">
      {showAwardedCard && card && momUserId ? (
        <ManOfMatchCard match={match} card={card} momUserId={momUserId} nameOf={nameOf} />
      ) : null}

      {canSelectMom ? (
        <ManOfMatchActionCard
          winningTeamName={winningTeamName}
          momEligibility={momEligibility}
          momPending={momPending}
          working={workingProp}
          inline={actionStyle === 'inline'}
          onPress={openSelectionPage}
        />
      ) : null}
    </View>
  );
}
