import type { InningsScorecard, MatchDetail, ScorecardResponse } from '@acc/types';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { BattingTeamLabel } from '../hooks/useMatchResolvers';
import {
  inningsForTab,
  inningsTabLabels,
  liveInnings,
  shouldShowLiveTopCards,
} from '../lib/scorecardInningsTabs';
import type { NameResolver } from './LiveScorecard';
import { InningsNotStartedPlaceholder } from './InningsNotStartedPlaceholder';
import { InningsLiveTopCards, InningsScorecardView } from './InningsScorecardView';
import { InningsTabs } from './InningsTabs';

export interface TabbedInningsScorecardProps {
  card: ScorecardResponse;
  match: MatchDetail | null;
  nameOf: NameResolver;
  teamNameOf: NameResolver;
  battingTeamLabel: (innings: InningsScorecard) => BattingTeamLabel;
  inningsIndex: number;
  onInningsIndexChange: (index: number) => void;
  /** When true, pinned live top cards may render above the tab bar. */
  isMatchLive: boolean;
  matchOversPerInnings: number | null;
}

/**
 * Tabbed innings scorecard shell (§28):
 * 1) Live top cards (pinned, live innings only) → 2) Team-name tabs → 3) Per-innings body.
 */
export function TabbedInningsScorecard({
  card,
  match,
  nameOf,
  teamNameOf,
  battingTeamLabel,
  inningsIndex,
  onInningsIndexChange,
  isMatchLive,
  matchOversPerInnings,
}: TabbedInningsScorecardProps): React.ReactElement {
  const tabLabels = useMemo(
    () => inningsTabLabels(card, match, teamNameOf, battingTeamLabel),
    [card, match, teamNameOf, battingTeamLabel],
  );

  const selectedInnings = inningsForTab(card, inningsIndex);
  const pinnedLiveInnings = liveInnings(card);
  const showLiveTopCards = shouldShowLiveTopCards(isMatchLive, card);

  return (
    <View className="gap-4">
      {showLiveTopCards && pinnedLiveInnings ? (
        <InningsLiveTopCards
          card={card}
          innings={pinnedLiveInnings}
          nameOf={nameOf}
          teamNameOf={teamNameOf}
          totalOvers={matchOversPerInnings ?? pinnedLiveInnings.oversAllotted}
          showLiveBadge={isMatchLive}
        />
      ) : null}

      <InningsTabs
        tabLabels={tabLabels}
        selectedIndex={inningsIndex}
        onSelect={onInningsIndexChange}
      />

      {selectedInnings ? (
        <InningsScorecardView
          card={card}
          innings={selectedInnings}
          nameOf={nameOf}
          teamNameOf={teamNameOf}
        />
      ) : (
        <InningsNotStartedPlaceholder teamName={tabLabels[inningsIndex] ?? 'Team'} />
      )}
    </View>
  );
}
