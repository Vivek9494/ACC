import {
  formatMatchTossSummaryLine,
  MATCH_STATE_LABELS,
  type AuthUser,
  type BatterCard,
  type BowlerCard,
  type InningsScorecard,
  type MatchDetail,
  type ScorecardResponse,
  type SquadPlayerView,
} from '@acc/types';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';

import { useScoringKeyboardShortcuts } from '../../../hooks/useScoringKeyboardShortcuts';
import { useLiveScore } from '../../../lib/live-socket';
import { Text } from '../../ui/Text';
import { BallByBallPanel } from './BallByBallPanel';
import { FieldingAnalysisPanel } from './FieldingAnalysisPanel';
import { OverlayScoreboardPanel } from './OverlayScoreboardPanel';
import { ScorecardDockPanel } from './ScorecardDockPanel';
import { ScoreSummaryPanel } from './ScoreSummaryPanel';
import { ScoringInputPanel } from './ScoringInputPanel';

/** Mockup grid — fixed tracks (not resizable). Web-only CSS Grid. */
const COCKPIT_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  flex: 1,
  minHeight: 0,
  gap: 7,
  padding: 7,
  gridTemplateColumns: '232px minmax(0, 1fr) 340px',
  gridTemplateRows: 'auto minmax(0, 1fr) minmax(168px, 28%)',
  gridTemplateAreas: `
    "summary summary scoreboard"
    "scoring balls scoreboard"
    "fielding scorecard scorecard"
  `,
} as ViewStyle;

const AREA = {
  summary: { gridArea: 'summary', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
  scoring: { gridArea: 'scoring', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
  balls: { gridArea: 'balls', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
  scoreboard: { gridArea: 'scoreboard', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
  fielding: { gridArea: 'fielding', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
  scorecard: { gridArea: 'scorecard', minHeight: 0, minWidth: 0, height: '100%' } as ViewStyle,
};

export interface ScoringCockpitProps {
  matchId: string;
  match: MatchDetail;
  card: ScorecardResponse;
  innings: InningsScorecard;
  user: AuthUser | null | undefined;
  nameOf: (id: string | null) => string;
  battingTeamName: string;
  bowlingTeamName: string;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  strikerCard: BatterCard | undefined;
  nonStrikerCard: BatterCard | undefined;
  bowlerCard: BowlerCard | undefined;
  battingXi: SquadPlayerView[];
  bowlingXi: SquadPlayerView[];
  keypadDisabled: boolean;
  keyboardEnabled: boolean;
  error: string | null;
  prompt: string | null;
  onRuns: (runs: number, isBoundary: boolean) => void;
  onWide: (ranPortion: number) => void;
  onNoBall: (runsBat: number) => void;
  onBye: (extraRuns: number) => void;
  onLegBye: (extraRuns: number) => void;
  onWicket: () => void;
  onPenalty: () => void;
  onLegalOddRuns: (runs: 5 | 7) => void;
  onUndo: () => void;
  onPickStriker: () => void;
  onPickNonStriker: () => void;
  onPickBowler: () => void;
}

export function ScoringCockpit({
  matchId,
  match,
  card,
  innings,
  user,
  nameOf,
  battingTeamName,
  bowlingTeamName,
  strikerId,
  nonStrikerId,
  bowlerId,
  strikerCard,
  nonStrikerCard,
  bowlerCard,
  battingXi,
  bowlingXi,
  keypadDisabled,
  keyboardEnabled,
  error,
  prompt,
  onRuns,
  onWide,
  onNoBall,
  onBye,
  onLegBye,
  onWicket,
  onPenalty,
  onLegalOddRuns,
  onUndo,
  onPickStriker,
  onPickNonStriker,
  onPickBowler,
}: ScoringCockpitProps): React.ReactElement {
  const live = useLiveScore(matchId, card);
  const toss = formatMatchTossSummaryLine(match);
  const playState = MATCH_STATE_LABELS[match.state] ?? match.state;

  useScoringKeyboardShortcuts({
    enabled: keyboardEnabled,
    onRuns,
    onWicket,
    onWide: () => onWide(0),
    onNoBall: () => onNoBall(0),
    onBye: () => onBye(1),
    onLegBye: () => onLegBye(1),
    onUndo,
  });

  return (
    <View className="min-h-0 flex-1 bg-background">
      {error ? (
        <View className="mx-2 mt-1 rounded-control bg-primary-50 px-3 py-1.5">
          <Text className="font-sans text-[11px] text-primary">{error}</Text>
        </View>
      ) : null}
      {prompt ? (
        <View className="mx-2 mt-1 rounded-control border border-primary bg-primary-container px-3 py-1.5">
          <Text className="font-sans-semibold text-[11px] text-on-primary-container">{prompt}</Text>
        </View>
      ) : null}

      <View style={COCKPIT_GRID}>
        <View style={AREA.summary}>
          <ScoreSummaryPanel
            match={match}
            innings={innings}
            battingTeamName={battingTeamName}
            bowlingTeamName={bowlingTeamName}
            nameOf={nameOf}
            strikerId={strikerId}
            nonStrikerId={nonStrikerId}
            bowlerId={bowlerId}
            strikerCard={strikerCard}
            nonStrikerCard={nonStrikerCard}
            bowlerCard={bowlerCard}
            onPickStriker={onPickStriker}
            onPickNonStriker={onPickNonStriker}
            onPickBowler={onPickBowler}
          />
        </View>
        <View style={AREA.scoring}>
          <ScoringInputPanel
            disabled={keypadDisabled}
            onRuns={onRuns}
            onWide={onWide}
            onNoBall={onNoBall}
            onBye={onBye}
            onLegBye={onLegBye}
            onWicket={onWicket}
            onPenalty={onPenalty}
            onLegalOddRuns={onLegalOddRuns}
            onUndo={onUndo}
          />
        </View>
        <View style={AREA.balls}>
          <BallByBallPanel innings={innings} nameOf={nameOf} />
        </View>
        <View style={AREA.scoreboard}>
          <OverlayScoreboardPanel matchId={matchId} />
        </View>
        <View style={AREA.fielding}>
          <FieldingAnalysisPanel bowlingXi={bowlingXi} nameOf={nameOf} />
        </View>
        <View style={AREA.scorecard}>
          <ScorecardDockPanel
            card={card}
            innings={innings}
            battingXi={battingXi}
            nameOf={nameOf}
          />
        </View>
      </View>

      <View className="h-6 flex-row items-center gap-4 border-t border-outline-variant bg-surface px-3">
        <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={1}>
          {playState}
          {toss ? ` — ${toss}` : ''}
        </Text>
        <View className="flex-1" />
        <Text className="font-sans text-[11px] text-on-surface-variant">Video Sync: N/A (stub)</Text>
        <Text className="font-sans text-[11px] text-on-surface-variant">
          Scoring Sync: {live.status === 'live' ? '● live' : live.status}
        </Text>
        <Text className="font-sans-semibold text-[11px] text-primary">
          Role: {user?.role ?? 'Scorer'} (server-enforced)
        </Text>
      </View>
    </View>
  );
}
