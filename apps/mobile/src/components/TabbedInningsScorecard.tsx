import {
  isWinningTeamInningsTab,
  type AuthUser,
  type InningsScorecard,
  type MatchDetail,
  type ScorecardResponse,
} from '@acc/types';
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
import { DroppedCatchCardSection } from './scoring/DroppedCatchCardSection';
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
  user?: AuthUser | null;
  /** MoM card — rendered below Batting on the winning team's tab when set. */
  manOfMatchSlot?: React.ReactNode;
  /** Registered winning team — gates MoM to that team's innings tab(s). */
  winningTeamId?: string | null;
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
  user,
  manOfMatchSlot,
  winningTeamId = null,
}: TabbedInningsScorecardProps): React.ReactElement {
  const tabLabels = useMemo(
    () => inningsTabLabels(card, match, teamNameOf, battingTeamLabel),
    [card, match, teamNameOf, battingTeamLabel],
  );

  const selectedInnings = inningsForTab(card, inningsIndex);
  const pinnedLiveInnings = liveInnings(card);
  const showLiveTopCards = shouldShowLiveTopCards(isMatchLive, card);
  const showManOfMatchOnTab =
    manOfMatchSlot != null &&
    selectedInnings != null &&
    isWinningTeamInningsTab(selectedInnings, winningTeamId);

  return (
    <View className="gap-4">
      {showLiveTopCards && pinnedLiveInnings ? (
        <InningsLiveTopCards
          card={card}
          innings={pinnedLiveInnings}
          nameOf={nameOf}
          teamNameOf={teamNameOf}
          totalOvers={pinnedLiveInnings.oversAllotted ?? matchOversPerInnings}
          showLiveBadge={false}
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
          manOfMatchSlot={showManOfMatchOnTab ? manOfMatchSlot : null}
          droppedCatchSlot={
            <DroppedCatchCardSection
              card={card}
              match={match}
              user={user}
              nameOf={nameOf}
              innings={selectedInnings}
            />
          }
        />
      ) : (
        <InningsNotStartedPlaceholder teamName={tabLabels[inningsIndex] ?? 'Team'} />
      )}
    </View>
  );
}
