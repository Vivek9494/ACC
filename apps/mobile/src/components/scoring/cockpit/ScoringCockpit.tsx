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
import { COCKPIT_MAX_WIDTH_PX } from '../../../lib/desktop-layout';
import { freshestScorecard, useLiveScore } from '../../../lib/live-socket';
import { Text } from '../../ui/Text';
import { BallByBallPanel } from './BallByBallPanel';
import { BroadcastObsPanel, hasAscObsBridge } from './BroadcastObsPanel';
import { formatMatchFolderStamp } from './clip-storage-paths';
import { OverlayControlPanel } from './OverlayControlPanel';
import { OverlayScoreboardPanel } from './OverlayScoreboardPanel';
import { ScorecardDockPanel } from './ScorecardDockPanel';
import { ScoreSummaryPanel } from './ScoreSummaryPanel';
import { ScoringInputPanel } from './ScoringInputPanel';
import { WagonWheelPanel } from './WagonWheelPanel';

/**
 * Mockup v6 structure (theme unchanged):
 * Top: natural height from left stack; columns 40:30:30 (Summary : Ball-by-Ball : Scoreboard).
 * Bottom: Overlay Control : Wagon Wheel : Scorecard at 40:20:40.
 *
 * Shell is CSS-sized (width 100% + maxWidth) so Electron BrowserView resizes reflow
 * without waiting on RN-web Dimensions. Outer centers only when the viewport exceeds
 * COCKPIT_MAX_WIDTH_PX (never alignSelf on the width:100% node).
 */
const COCKPIT_OUTER: ViewStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  alignItems: 'center',
};

const COCKPIT_SHELL: ViewStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  maxWidth: COCKPIT_MAX_WIDTH_PX,
};

const COCKPIT_ROOT: ViewStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  gap: 7,
  padding: 7,
  // Keep grid paint inside the shell — children scroll internally if needed.
  overflow: 'hidden',
};

const TOP_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto',
  gap: 7,
  gridTemplateColumns: 'minmax(0, 40fr) minmax(0, 30fr) minmax(0, 30fr)',
  gridTemplateRows: 'auto',
  gridTemplateAreas: '"stack balls scoreboard"',
  alignItems: 'stretch',
  overflow: 'hidden',
} as ViewStyle;

const STACK_COL: ViewStyle = {
  gridArea: 'stack',
  minWidth: 0,
  maxWidth: '100%',
  gap: 7,
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'start',
  width: '100%',
  overflow: 'hidden',
} as unknown as ViewStyle;

const BALLS_COL: ViewStyle = {
  gridArea: 'balls',
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 0,
  width: '100%',
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as ViewStyle;

const SCOREBOARD_COL: ViewStyle = {
  gridArea: 'scoreboard',
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 0,
  width: '100%',
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  overflow: 'hidden',
} as ViewStyle;

/** When Broadcast/OBS is present, cap the stream preview so OBS controls fit. */
const SCOREBOARD_PREVIEW_WITH_OBS: ViewStyle = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  maxHeight: 220,
};

const BOTTOM_BAND: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
  minHeight: 168,
  gap: 7,
  gridTemplateColumns: 'minmax(0, 40fr) minmax(0, 20fr) minmax(0, 40fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
  alignItems: 'stretch',
  overflow: 'hidden',
} as ViewStyle;

const OVERLAY_CONTROL_COL: ViewStyle = {
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as ViewStyle;

const WAGON_COL: ViewStyle = {
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as ViewStyle;

const SCORECARD_COL: ViewStyle = {
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as ViewStyle;

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
  /** Match result when decided — under Toss + same value as top prompt on completion. */
  resultLine?: string | null;
  onRuns: (runs: number, isBoundary: boolean) => void;
  onWide: (ranPortion: number) => void;
  onNoBall: (runsBat: number) => void;
  onBye: (extraRuns: number) => void;
  onLegBye: (extraRuns: number) => void;
  onWicket: () => void;
  onOpenCatchDrop: () => void;
  onOpenBonus: () => void;
  onOpenMore: () => void;
  onPenalty: () => void;
  onUndo: () => void;
  onSelectStriker: (userId: string) => void;
  onSelectNonStriker: (userId: string) => void;
  onSelectBowler: (userId: string) => void;
  working?: boolean;
  onSetShotPlacement: (
    target: { deliveryId?: string; sequence: number },
    shotX: number | null,
    shotY: number | null,
  ) => void;
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
  bowlingXi: _bowlingXi,
  keypadDisabled,
  keyboardEnabled,
  error,
  prompt,
  resultLine = null,
  onRuns,
  onWide,
  onNoBall,
  onBye,
  onLegBye,
  onWicket,
  onOpenCatchDrop,
  onOpenBonus,
  onOpenMore,
  onPenalty,
  onUndo,
  onSelectStriker,
  onSelectNonStriker,
  onSelectBowler,
  working,
  onSetShotPlacement,
}: ScoringCockpitProps): React.ReactElement {
  const live = useLiveScore(matchId, card);
  /** Never prefer a stale socket frame over a newer REST card (or vice versa). */
  const displayCard = freshestScorecard(card, live.state) ?? card;
  const displayInnings = displayCard.innings.at(-1) ?? innings;
  const toss = formatMatchTossSummaryLine(match);
  const playState = MATCH_STATE_LABELS[match.state] ?? match.state;
  const showObs = hasAscObsBridge();
  const matchFolderStamp = formatMatchFolderStamp(match);

  useScoringKeyboardShortcuts({
    enabled: keyboardEnabled,
    onRuns,
    onWicket,
    onWide: () => onWide(0),
    onNoBall: () => onNoBall(0),
    onBye: () => onBye(1),
    onLegBye: () => onLegBye(1),
    onUndo,
    /** Scoring keypad End Ball ⏎ label only — engine commits on each key. */
    onEndBall: () => {},
  });

  return (
    <View style={COCKPIT_OUTER}>
      <View style={COCKPIT_SHELL}>
        <View className="min-h-0 min-w-0 flex-1 bg-background" style={{ width: '100%' }}>
          {error ? (
            <View className="mx-2 mt-1 rounded-control bg-primary-50 px-3 py-1.5">
              <Text className="font-sans text-[11px] text-primary">{error}</Text>
            </View>
          ) : null}
          {prompt ? (
            <View className="mx-2 mt-1 rounded-control border border-primary bg-primary-container px-3 py-1.5">
              <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                {prompt}
              </Text>
            </View>
          ) : null}

          <View style={COCKPIT_ROOT}>
            <View style={TOP_GRID}>
              <View style={STACK_COL}>
                <ScoreSummaryPanel
                  matchId={matchId}
                  match={match}
                  innings={displayInnings}
                  battingTeamName={battingTeamName}
                  bowlingTeamName={bowlingTeamName}
                  nameOf={nameOf}
                  strikerId={strikerId}
                  nonStrikerId={nonStrikerId}
                  bowlerId={bowlerId}
                  strikerCard={strikerCard}
                  nonStrikerCard={nonStrikerCard}
                  bowlerCard={bowlerCard}
                  onSelectStriker={onSelectStriker}
                  onSelectNonStriker={onSelectNonStriker}
                  onSelectBowler={onSelectBowler}
                  onUndo={onUndo}
                  working={working}
                  resultLine={resultLine}
                />
                <ScoringInputPanel
                  disabled={keypadDisabled}
                  onRuns={onRuns}
                  onWide={onWide}
                  onNoBall={onNoBall}
                  onBye={onBye}
                  onLegBye={onLegBye}
                  onWicket={onWicket}
                  onOpenCatchDrop={onOpenCatchDrop}
                  onOpenBonus={onOpenBonus}
                  onOpenMore={onOpenMore}
                  onPenalty={onPenalty}
                />
              </View>
              <View style={BALLS_COL}>
                <BallByBallPanel innings={displayInnings} nameOf={nameOf} />
              </View>
              <View style={SCOREBOARD_COL}>
                {showObs ? (
                  <BroadcastObsPanel
                    matchId={matchId}
                    matchFolderStamp={matchFolderStamp}
                    card={displayCard}
                    matchState={match.state}
                  />
                ) : null}
                <View style={showObs ? SCOREBOARD_PREVIEW_WITH_OBS : { flex: 1, minHeight: 0 }}>
                  <OverlayScoreboardPanel youtubeUrl={match.youtubeUrl} />
                </View>
              </View>
            </View>

            <View style={BOTTOM_BAND}>
              <View style={OVERLAY_CONTROL_COL}>
                <OverlayControlPanel
                  matchId={matchId}
                  match={match}
                  card={displayCard}
                  innings={displayInnings}
                  nameOf={nameOf}
                />
              </View>
              <View style={WAGON_COL}>
                <WagonWheelPanel
                  innings={displayInnings}
                  nameOf={nameOf}
                  working={working}
                  onSetShotPlacement={onSetShotPlacement}
                />
              </View>
              <View style={SCORECARD_COL}>
                <ScorecardDockPanel
                  card={displayCard}
                  innings={displayInnings}
                  battingXi={battingXi}
                  nameOf={nameOf}
                />
              </View>
            </View>
          </View>

          <View className="h-6 flex-row items-center gap-4 border-t border-outline-variant bg-surface px-3">
            <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={1}>
              {playState}
              {toss ? ` — ${toss}` : ''}
            </Text>
            <View className="flex-1" />
            <Text className="font-sans text-[11px] text-on-surface-variant">
              Video Sync: N/A (stub)
            </Text>
            <Text className="font-sans text-[11px] text-on-surface-variant">
              Scoring Sync: {live.status === 'live' ? '● live' : live.status}
            </Text>
            <Text className="font-sans-semibold text-[11px] text-primary">
              Role: {user?.role ?? 'Scorer'} (server-enforced)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
