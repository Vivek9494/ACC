import {
  deriveLiveInningsRunStats,
  PROJECTED_SCORE_REFERENCE_RPO,
  type InningsScorecard,
  type LiveInningsRunStats,
} from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface LiveScoringHeaderProps {
  /** e.g. "Barrie Cobras vs Scarborough Strikeforce" */
  matchLabel: string;
  /** e.g. "League Match" from MatchType */
  matchTypeLabel: string;
  innings: InningsScorecard | null;
  /** Resolved match allotment (`oversPerInnings` / innings `oversAllotted`). */
  totalOvers: number | null;
  /** When false, hide all rate / chase / projection stats (openers not set). */
  showRunStats?: boolean;
  compact?: boolean;
}

function StatsLine({
  stats,
  compact,
}: {
  stats: LiveInningsRunStats;
  compact: boolean;
}): React.ReactElement | null {
  if (!stats.isChase && !stats.ratesReady) {
    return null;
  }

  const textClass = compact
    ? 'font-sans text-[11px] text-on-surface-variant'
    : 'font-sans text-sm text-on-surface-variant';

  if (stats.isChase && !stats.ratesReady) {
    return (
      <Text className={textClass}>
        Target:{' '}
        <Text className="font-sans-semibold text-on-surface">{stats.target}</Text>
      </Text>
    );
  }

  if (stats.isChase && stats.ratesReady) {
    return (
      <Text className={textClass}>
        CRR:{' '}
        <Text className="font-sans-semibold text-on-surface">{stats.crrText}</Text>
        {' • '}
        Target:{' '}
        <Text className="font-sans-semibold text-on-surface">{stats.target}</Text>
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
    <View className={`rounded-control bg-primary-container ${compact ? 'px-3 py-2' : 'p-4'}`}>
      {stats.ratesReady && stats.rrrText != null ? (
        <View className="mb-1.5">
          <Text
            className={`font-sans-semibold uppercase tracking-wide text-on-primary-container/80 ${
              compact ? 'text-[10px]' : 'text-xs'
            }`}
          >
            Required run rate
          </Text>
          <Text
            className={`font-sans-bold leading-none text-on-primary-container ${
              compact ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {stats.rrrText}
          </Text>
        </View>
      ) : null}
      {stats.chaseNeedsLine ? (
        <Text
          className={`font-sans-semibold text-on-primary-container ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          {stats.chaseNeedsLine}
        </Text>
      ) : null}
    </View>
  );
}

function LivePill({ compact }: { compact: boolean }): React.ReactElement {
  return (
    <View
      className={`flex-row items-center rounded-full bg-primary ${
        compact ? 'gap-1 px-2 py-0.5' : 'gap-1.5 px-2.5 py-1'
      }`}
    >
      <View className={`rounded-full bg-text-inverse ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
      <Text
        className={`font-sans-semibold text-text-inverse ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        LIVE
      </Text>
    </View>
  );
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
  compact,
}: {
  stats: LiveInningsRunStats;
  compact: boolean;
}): React.ReactElement | null {
  const lineVisible = showStatsLine(stats);
  const boxVisible = showBottomBox(stats);

  if (!lineVisible && !boxVisible) {
    return null;
  }

  return (
    <>
      {lineVisible ? <StatsLine stats={stats} compact={compact} /> : null}
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

/** Live score card — match stage, LIVE pill, derived score/overs, CRR, and projections/chase. */
export function LiveScoringHeader({
  matchLabel,
  matchTypeLabel,
  innings,
  totalOvers,
  showRunStats = false,
  compact = false,
}: LiveScoringHeaderProps): React.ReactElement {
  const scoreLine = innings ? `${innings.runs}/${innings.wickets}` : '0/0';
  const oversLine = innings ? innings.oversText : '0.0';
  const stats =
    showRunStats && innings
      ? deriveLiveInningsRunStats(innings, totalOvers ?? innings.oversAllotted)
      : null;

  if (compact) {
    return (
      <View
        className="gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2"
        style={INPUT_SHADOW_STYLE}
      >
        <Text
          className="font-sans-medium text-[10px] uppercase tracking-wide text-on-surface-variant"
          numberOfLines={1}
        >
          {matchLabel}
          {matchTypeLabel ? ` · ${matchTypeLabel}` : ''}
        </Text>

        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Text className="font-sans-bold text-3xl text-on-surface">{scoreLine}</Text>
              <Text className="font-sans-medium text-sm text-on-surface-variant">
                ({oversLine} Overs)
              </Text>
            </View>
            {stats ? (
              <View className="mt-1 gap-2">
                <StatsPanel stats={stats} compact />
              </View>
            ) : null}
          </View>
          <View className="items-end gap-1">
            <LivePill compact />
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
        <LivePill compact={false} />
      </View>

      <Text className="pr-24 font-sans-medium text-xs text-on-surface-variant">
        {matchLabel}
        {matchTypeLabel ? ` · ${matchTypeLabel}` : ''}
      </Text>

      <View className="flex-row flex-wrap items-baseline gap-2">
        <Text className="font-sans-bold text-4xl text-on-surface">{scoreLine}</Text>
        <Text className="font-sans text-lg text-on-surface-variant">({oversLine} Overs)</Text>
      </View>

      {stats ? <StatsPanel stats={stats} compact={false} /> : null}

      {innings?.freeHitNext ? (
        <Text className="font-sans-semibold text-sm uppercase tracking-wide text-primary">
          Free hit next ball
        </Text>
      ) : null}
    </View>
  );
}
