import {
  deriveLiveInningsRunStats,
  formatLiveTargetLabel,
  PROJECTED_SCORE_REFERENCE_RPO,
  type InningsScorecard,
  type LiveInningsRunStats,
  type MatchState,
} from '@acc/types';
import { View } from 'react-native';

import { MatchCardDisplayBadge } from '../tournament/MatchCardDisplayBadge';
import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface LiveScoringHeaderProps {
  /** Tournament display name — e.g. "APL 2026". Omitted when unavailable. */
  tournamentName?: string | null;
  /** e.g. "Bhakti Colony Lions vs Brampton Bombers" */
  teamsLabel: string;
  /** e.g. "League Match" from MatchType */
  matchTypeLabel: string;
  /** Match result line when decided — e.g. "Brantford Sharks won by 8 wickets". */
  resultLine?: string | null;
  /** Machine match state — drives the status badge via shared list-card mapping. */
  matchState: MatchState | string;
  innings: InningsScorecard | null;
  /** Resolved match allotment (`oversPerInnings` / innings `oversAllotted`). */
  totalOvers: number | null;
  /**
   * Original chase target (first-innings total + 1). When the live target differs,
   * shown as "Target: 170 (was 180)".
   */
  originalTarget?: number | null;
  /** When false, hide all rate / chase / projection stats (openers not set). */
  showRunStats?: boolean;
  compact?: boolean;
}

function StatsLine({
  stats,
  originalTarget,
  compact,
}: {
  stats: LiveInningsRunStats;
  originalTarget?: number | null;
  compact: boolean;
}): React.ReactElement | null {
  if (!stats.isChase && !stats.ratesReady) {
    return null;
  }

  const textClass = compact
    ? 'font-sans text-sm text-on-surface-variant'
    : 'font-sans text-base text-on-surface-variant';
  const targetLabel = formatLiveTargetLabel(stats.target, originalTarget);

  if (stats.isChase && !stats.ratesReady) {
    return (
      <Text className={textClass}>
        Target:{' '}
        <Text className="font-sans-semibold text-on-surface">{targetLabel}</Text>
      </Text>
    );
  }

  if (stats.isChase && stats.ratesReady) {
    return (
      <Text className={`${textClass} flex-shrink`}>
        CRR:{' '}
        <Text className="font-sans-semibold text-on-surface">{stats.crrText}</Text>
        {' • '}
        Target:{' '}
        <Text className="font-sans-semibold text-on-surface">{targetLabel}</Text>
        {stats.rrrText != null ? (
          <>
            {' • '}
            RRR:{' '}
            <Text className="font-sans-semibold text-on-surface">{stats.rrrText}</Text>
          </>
        ) : null}
      </Text>
    );
  }

  return (
    <Text className={textClass}>
      CRR: <Text className="font-sans-semibold text-on-surface">{stats.crrText}</Text>
    </Text>
  );
}

function ProjectedScoreBox({
  stats,
  compact,
}: {
  stats: LiveInningsRunStats;
  compact: boolean;
}): React.ReactElement {
  return (
    <View className={`rounded-control bg-primary-container ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <Text
        className={`font-sans-semibold uppercase tracking-wide text-on-primary-container/80 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        Projected score
      </Text>
      <View className="mt-1 flex-row items-end justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className={`text-on-primary-container/90 ${compact ? 'text-[11px]' : 'text-sm'}`}>
            at current
          </Text>
          <Text
            className={`font-sans-bold leading-none text-on-primary-container ${
              compact ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {stats.projectedAtCurrent}
          </Text>
        </View>
        <View className="min-w-0 flex-1 border-l border-on-primary-container/20 pl-4">
          <Text className={`text-on-primary-container/90 ${compact ? 'text-[11px]' : 'text-sm'}`}>
            at {PROJECTED_SCORE_REFERENCE_RPO} RPO
          </Text>
          <Text
            className={`font-sans-bold leading-none text-on-primary-container ${
              compact ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {stats.projectedAtReferenceRpo}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChaseInfoBox({
  stats,
  compact,
}: {
  stats: LiveInningsRunStats;
  compact: boolean;
}): React.ReactElement {
  return (
    <View
      className={`rounded-control bg-primary-container ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      }`}
    >
      {stats.chaseNeedsLine ? (
        <Text
          className={`text-left font-sans-semibold text-on-primary-container ${
            compact ? 'text-sm leading-5' : 'text-base leading-6'
          }`}
        >
          {stats.chaseNeedsLine}
        </Text>
      ) : null}
    </View>
  );
}

function TournamentMatchTypeLine({
  tournamentName,
  matchTypeLabel,
  compact,
}: {
  tournamentName?: string | null;
  matchTypeLabel: string;
  compact: boolean;
}): React.ReactElement | null {
  const tournament = tournamentName?.trim();
  const matchType = matchTypeLabel.trim();

  if (!tournament && !matchType) {
    return null;
  }

  let line: React.ReactNode;
  if (tournament && matchType) {
    line = (
      <>
        <Text className="uppercase text-primary">{tournament}</Text>
        <Text className="text-on-surface-variant">{` · ${matchType}`}</Text>
      </>
    );
  } else if (tournament) {
    line = <Text className="uppercase text-primary">{tournament}</Text>;
  } else {
    line = matchType;
  }

  return (
    <Text
      className={`font-sans-medium tracking-wide text-on-surface-variant text-xs ${
        compact ? 'pr-16' : 'pr-24'
      }`}
    >
      {line}
    </Text>
  );
}

function MatchStatusBadge({ state }: { state: MatchState | string }): React.ReactElement {
  return <MatchCardDisplayBadge state={state} />;
}

function showStatsLine(stats: LiveInningsRunStats): boolean {
  if (stats.isChase) {
    return stats.target != null;
  }
  return stats.ratesReady;
}

function showBottomBox(stats: LiveInningsRunStats): boolean {
  if (stats.isChase) {
    return stats.chaseNeedsLine != null;
  }
  return stats.ratesReady;
}

function StatsPanel({
  stats,
  originalTarget,
  compact,
}: {
  stats: LiveInningsRunStats;
  originalTarget?: number | null;
  compact: boolean;
}): React.ReactElement | null {
  const lineVisible = showStatsLine(stats);
  const boxVisible = showBottomBox(stats);

  if (!lineVisible && !boxVisible) {
    return null;
  }

  return (
    <>
      {lineVisible ? (
        <StatsLine stats={stats} originalTarget={originalTarget} compact={compact} />
      ) : null}
      {boxVisible ? (
        stats.isChase ? (
          <ChaseInfoBox stats={stats} compact={compact} />
        ) : (
          <ProjectedScoreBox stats={stats} compact={compact} />
        )
      ) : null}
    </>
  );
}

function MatchResultLine({
  resultLine,
  compact,
}: {
  resultLine: string;
  compact: boolean;
}): React.ReactElement {
  return (
    <Text
      className={`font-sans-semibold text-primary ${
        compact ? 'text-sm leading-5' : 'text-base leading-6'
      }`}
    >
      {resultLine}
    </Text>
  );
}

/** Live score card — match stage, LIVE pill, derived score/overs, CRR, and projections/chase. */
export function LiveScoringHeader({
  tournamentName,
  teamsLabel,
  matchTypeLabel,
  resultLine,
  matchState,
  innings,
  totalOvers,
  originalTarget = null,
  showRunStats = false,
  compact = false,
}: LiveScoringHeaderProps): React.ReactElement {
  const scoreLine = innings ? `${innings.runs}/${innings.wickets}` : '0/0';
  const oversLine = innings ? innings.oversText : '0.0';
  const stats =
    showRunStats && innings
      ? deriveLiveInningsRunStats(innings, innings.oversAllotted ?? totalOvers)
      : null;

  if (compact) {
    return (
      <View
        className="gap-1.5 rounded-control border border-outline-variant bg-surface px-3 py-2"
        style={INPUT_SHADOW_STYLE}
      >
        <TournamentMatchTypeLine
          tournamentName={tournamentName}
          matchTypeLabel={matchTypeLabel}
          compact
        />

        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={2}>
              {teamsLabel}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Text className="font-sans-bold text-3xl text-on-surface">{scoreLine}</Text>
              <Text className="font-sans-medium text-base text-on-surface-variant">
                ({oversLine} Overs)
              </Text>
            </View>
            {resultLine ? (
              <View className="mt-1">
                <MatchResultLine resultLine={resultLine} compact />
              </View>
            ) : null}
            {stats ? (
              <View className="mt-1 gap-2">
                <StatsPanel stats={stats} originalTarget={originalTarget} compact />
              </View>
            ) : null}
          </View>
          <View className="items-end gap-1">
            <MatchStatusBadge state={matchState} />
            {innings?.freeHitNext ? (
              <Text className="font-sans-semibold text-[10px] uppercase tracking-wide text-primary">
                Free hit
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="relative gap-3 overflow-hidden rounded-control border border-outline-variant bg-surface p-5"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="absolute right-4 top-4">
        <MatchStatusBadge state={matchState} />
      </View>

      <TournamentMatchTypeLine
        tournamentName={tournamentName}
        matchTypeLabel={matchTypeLabel}
        compact={false}
      />

      <Text className="pr-24 font-sans-semibold text-base text-on-surface">{teamsLabel}</Text>

      <View className="flex-row flex-wrap items-baseline gap-2">
        <Text className="font-sans-bold text-4xl text-on-surface">{scoreLine}</Text>
        <Text className="font-sans text-lg text-on-surface-variant">({oversLine} Overs)</Text>
      </View>

      {resultLine ? <MatchResultLine resultLine={resultLine} compact={false} /> : null}

      {stats ? (
        <StatsPanel stats={stats} originalTarget={originalTarget} compact={false} />
      ) : null}

      {innings?.freeHitNext ? (
        <Text className="font-sans-semibold text-sm uppercase tracking-wide text-primary">
          Free hit next ball
        </Text>
      ) : null}
    </View>
  );
}
