import {
  formatBatterStatus,
  formatFallOfWicketDetail,
  formatFallOfWicketHeadline,
  partnershipRunRate,
  type AuthUser,
  type CompletedPartnership,
  type InningsScorecard,
  type MatchDetail,
  type ScorecardResponse,
  type TimelineEntry,
} from '@acc/types';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { useScorecardResolvers } from '../../hooks/useMatchResolvers';
import { useAuth } from '../../lib/auth-context';
import {
  defaultLiveScorecardInningsIndex,
  LIVE_SCORECARD_INNINGS_TAB_LABELS,
  showLiveScorecardInningsTabs,
} from '../../lib/scorecardInningsTabs';
import { DroppedCatchCardSection } from './DroppedCatchCardSection';
import { InningsTabs } from '../InningsTabs';
import { BowlerFiguresScrollTable } from './BowlerFiguresScrollTable';
import { DetailedBattingScrollTable } from './DetailedBattingScrollTable';
import {
  LIVE_SCORECARD_TYPE,
  SCORECARD_WICKET_EVENT_CARD,
  SCORECARD_WICKET_EVENT_DETAIL,
  SCORECARD_WICKET_EVENT_HEADLINE,
} from './liveScoringScorecardTypography';
import { recentBallChipStyle } from './liveScoringKeypadTokens';
import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

function ScorecardSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      className="gap-3 rounded-control border border-outline-variant bg-surface p-3"
      style={INPUT_SHADOW_STYLE}
    >
      {title ? (
        <Text className={LIVE_SCORECARD_TYPE.sectionTitle}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

function formatScorecardExtrasLabel(extras: InningsScorecard['extras']): string {
  const parts = [
    `WD ${extras.wides}`,
    `NB ${extras.noBalls}`,
    `B ${extras.byes}`,
    `LB ${extras.legByes}`,
  ];
  if (extras.penalties > 0) {
    parts.push(`P ${extras.penalties}`);
  }
  return `Extras (${parts.join(', ')})`;
}

function ExtrasBreakdownCard({
  extras,
}: {
  extras: InningsScorecard['extras'];
}): React.ReactElement {
  return (
    <ScorecardSection>
      <View className="flex-row items-start justify-between gap-3">
        <Text className={`min-w-0 flex-1 ${LIVE_SCORECARD_TYPE.bodyMuted}`}>
          {formatScorecardExtrasLabel(extras)}
        </Text>
        <Text className={`shrink-0 ${LIVE_SCORECARD_TYPE.statBold} text-on-surface`}>
          {extras.total}
        </Text>
      </View>
    </ScorecardSection>
  );
}

function InningsTotalCard({ innings }: { innings: InningsScorecard }): React.ReactElement {
  return (
    <ScorecardSection>
      <View className="flex-row items-center justify-between gap-3">
        <Text className={LIVE_SCORECARD_TYPE.bodyBold}>TOTAL</Text>
        <View className="shrink-0 flex-row items-baseline gap-2">
          <Text className={`${LIVE_SCORECARD_TYPE.statBold} text-on-surface`}>
            {innings.runs}/{innings.wickets}
          </Text>
          <Text className={LIVE_SCORECARD_TYPE.bodyMuted}>({innings.oversText})</Text>
        </View>
      </View>
    </ScorecardSection>
  );
}

function PartnershipCard({
  innings,
  nameOf,
  title,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
  title: string;
}): React.ReactElement | null {
  const partnership = innings.partnership;
  if (!partnership) {
    return null;
  }

  const rr = partnershipRunRate(partnership.runs, partnership.balls);

  return (
    <ScorecardSection title={title}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="gap-0.5">
          <Text className={LIVE_SCORECARD_TYPE.partnershipRuns}>
            {partnership.runs}
            <Text className={LIVE_SCORECARD_TYPE.partnershipRunsSuffix}> runs</Text>
          </Text>
          <Text className={LIVE_SCORECARD_TYPE.partnershipMeta}>
            ({partnership.balls} balls)
            <Text className="text-on-surface-variant"> • </Text>
            <Text className="font-sans-semibold text-secondary">RR {rr.toFixed(1)}</Text>
          </Text>
        </View>
        <View className="shrink-0 gap-1">
          {[...new Set(partnership.batterIds)].map((id) => {
            const contribution =
              partnership.batterRuns.find((row) => row.playerId === id)?.runs ?? 0;
            const onStrike = !innings.closed && id === innings.currentStrikerId;
            return (
              <View key={id} className="flex-row items-center justify-end gap-2">
                <Text
                  className={`max-w-[132px] ${LIVE_SCORECARD_TYPE.label} ${
                    onStrike ? 'text-primary' : 'text-on-surface'
                  }`}
                  numberOfLines={1}
                >
                  {nameOf(id)}
                </Text>
                <Text
                  className={`min-w-[28px] text-right ${LIVE_SCORECARD_TYPE.statBold} ${
                    onStrike ? 'text-primary' : 'text-on-surface'
                  }`}
                >
                  {contribution}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScorecardSection>
  );
}

function partnershipBatterRuns(
  stand: Pick<CompletedPartnership, 'batterRuns'>,
  batterId: string,
): number {
  return stand.batterRuns.find((row) => row.playerId === batterId)?.runs ?? 0;
}

function PartnershipContributionBar({
  leftRuns,
  rightRuns,
}: {
  leftRuns: number;
  rightRuns: number;
}): React.ReactElement {
  const total = leftRuns + rightRuns;
  if (total === 0) {
    return <View className="h-2 rounded-full bg-surface-container" />;
  }

  return (
    <View className="h-2 flex-row overflow-hidden rounded-full">
      {leftRuns > 0 ? (
        <View
          className="bg-primary"
          style={{
            flex: leftRuns,
            minWidth: rightRuns > 0 ? 2 : undefined,
          }}
        />
      ) : null}
      {rightRuns > 0 ? (
        <View
          className="bg-secondary-900"
          style={{
            flex: rightRuns,
            minWidth: leftRuns > 0 ? 2 : undefined,
          }}
        />
      ) : null}
    </View>
  );
}

function PartnershipRow({
  stand,
  nameOf,
}: {
  stand: CompletedPartnership;
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const leftId = stand.batterIds[0];
  const rightId = stand.batterIds[1];
  const leftRuns = leftId ? partnershipBatterRuns(stand, leftId) : 0;
  const rightRuns = rightId ? partnershipBatterRuns(stand, rightId) : 0;

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center">
        <Text className={`min-w-0 flex-1 ${LIVE_SCORECARD_TYPE.body}`} numberOfLines={1}>
          {leftId ? `${nameOf(leftId)} (${leftRuns})` : ''}
        </Text>
        <Text className={`shrink-0 px-1.5 text-center ${LIVE_SCORECARD_TYPE.bodyPrimary}`}>
          {stand.runs} ({stand.balls})
        </Text>
        <Text
          className={`min-w-0 flex-1 text-right ${LIVE_SCORECARD_TYPE.body}`}
          numberOfLines={1}
        >
          {rightId ? `(${rightRuns}) ${nameOf(rightId)}` : ''}
        </Text>
      </View>
      {leftId && rightId ? (
        <PartnershipContributionBar leftRuns={leftRuns} rightRuns={rightRuns} />
      ) : null}
    </View>
  );
}

function buildPartnershipStandRows(innings: InningsScorecard): CompletedPartnership[] {
  const rows: CompletedPartnership[] = [...innings.partnerships];
  if (innings.partnership) {
    rows.push({
      batterIds: innings.partnership.batterIds,
      batterRuns: innings.partnership.batterRuns,
      runs: innings.partnership.runs,
      balls: innings.partnership.balls,
    });
  }
  return rows;
}

/** Completed stands for the Partnerships section — drops the trailing stand when the innings ended. */
function partnershipStandRowsForDisplay(innings: InningsScorecard): CompletedPartnership[] {
  const rows = buildPartnershipStandRows(innings);
  if (innings.closed && rows.length > 0) {
    return rows.slice(0, -1);
  }
  return rows;
}

function PartnershipsList({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
}): React.ReactElement | null {
  const stands = useMemo(() => partnershipStandRowsForDisplay(innings), [innings]);
  if (stands.length === 0) {
    return null;
  }

  return (
    <ScorecardSection title="Partnerships">
      <View className="gap-4">
        {stands.map((stand, index) => (
          <PartnershipRow
            key={`${stand.batterIds.join('-')}-${index}`}
            stand={stand}
            nameOf={nameOf}
          />
        ))}
      </View>
    </ScorecardSection>
  );
}

function FallOfWicketsList({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
}): React.ReactElement | null {
  if (innings.fallOfWickets.length === 0) {
    return null;
  }

  return (
    <ScorecardSection title="Fall of wickets">
      <View className="gap-2">
        {innings.fallOfWickets.map((fow) => (
          <View key={fow.wicketNumber} className={SCORECARD_WICKET_EVENT_CARD}>
            <Text className={SCORECARD_WICKET_EVENT_HEADLINE}>
              {formatFallOfWicketHeadline(fow)}
            </Text>
            <Text className={SCORECARD_WICKET_EVENT_DETAIL}>
              {formatFallOfWicketDetail(fow, nameOf)}
            </Text>
          </View>
        ))}
      </View>
    </ScorecardSection>
  );
}

function BallChip({ entry }: { entry: TimelineEntry }): React.ReactElement {
  const chip = recentBallChipStyle(entry.code, entry.isWicket);
  const textSize =
    chip.label.length > 3 ? 'text-xs' : chip.label.length > 2 ? 'text-sm' : 'text-sm';

  return (
    <View className={`h-9 min-w-9 items-center justify-center rounded-full px-1.5 ${chip.bgClass}`}>
      <Text className={`font-sans-bold ${textSize} ${chip.textClass}`}>{chip.label}</Text>
    </View>
  );
}

function groupTimelineEntriesByOver(
  timeline: TimelineEntry[],
): { overNumber: number; entries: TimelineEntry[] }[] {
  const map = new Map<number, TimelineEntry[]>();
  for (const entry of timeline) {
    if (entry.overNumber === null) {
      continue;
    }
    const list = map.get(entry.overNumber) ?? [];
    list.push(entry);
    map.set(entry.overNumber, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([overNumber, entries]) => ({ overNumber, entries }));
}

function BallByBallByOver({ timeline }: { timeline: TimelineEntry[] }): React.ReactElement | null {
  const overs = useMemo(() => groupTimelineEntriesByOver(timeline), [timeline]);
  if (overs.length === 0) {
    return null;
  }

  return (
    <ScorecardSection title="Ball-by-ball">
      <View className="gap-3">
        {overs.map((over) => (
          <View key={over.overNumber} className="gap-1.5">
            <Text className={LIVE_SCORECARD_TYPE.overHeader}>Over {over.overNumber}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {over.entries.map((entry) => (
                <BallChip key={entry.sequence} entry={entry} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScorecardSection>
  );
}

interface InningsScorecardBodyProps {
  card: ScorecardResponse;
  match: MatchDetail | null;
  innings: InningsScorecard;
  teamName: string;
  nameOf: (id: string | null) => string;
  user: AuthUser | null | undefined;
}

/** Per-innings scorecard sections — memoized so tab switches don't recompute presentation. */
const InningsScorecardBody = memo(function InningsScorecardBody({
  card,
  match,
  innings,
  teamName,
  nameOf,
  user,
}: InningsScorecardBodyProps): React.ReactElement {
  const isLiveInnings = !innings.closed;

  const battingRows = useMemo(
    () =>
      innings.batters.map((batter) => {
        const notOut = !batter.isOut;
        const liveRow = isLiveInnings && notOut;
        const onStrike = batter.playerId === innings.currentStrikerId;
        const statusLine =
          formatBatterStatus(batter, nameOf) + (liveRow && onStrike ? ' ★' : '');
        return {
          id: batter.playerId,
          name: notOut ? `${nameOf(batter.playerId)}*` : nameOf(batter.playerId),
          statusLine,
          card: batter,
          highlightName: liveRow,
        };
      }),
    [innings, isLiveInnings, nameOf],
  );

  const bowlingRows = useMemo(
    () =>
      innings.bowlers.map((bowler) => ({
        id: bowler.playerId,
        name: nameOf(bowler.playerId),
        card: bowler,
        highlightName: bowler.playerId === innings.currentBowlerId && isLiveInnings,
        nameSuffix: bowler.playerId === innings.currentBowlerId && isLiveInnings ? '*' : '',
      })),
    [innings, isLiveInnings, nameOf],
  );

  return (
    <View className="gap-3">
      <ScorecardSection title={`${teamName} — Batting`}>
        <DetailedBattingScrollTable rows={battingRows} />
      </ScorecardSection>

      <ExtrasBreakdownCard extras={innings.extras} />
      <InningsTotalCard innings={innings} />

      {isLiveInnings && innings.partnership ? (
        <PartnershipCard innings={innings} nameOf={nameOf} title="Current partnership" />
      ) : null}

      {innings.bowlers.length > 0 ? (
        <ScorecardSection title="Bowling">
          <BowlerFiguresScrollTable density="scorecard" rows={bowlingRows} />
        </ScorecardSection>
      ) : null}

      <DroppedCatchCardSection
        card={card}
        match={match}
        user={user}
        nameOf={nameOf}
        innings={innings}
      />

      <FallOfWicketsList innings={innings} nameOf={nameOf} />
      <PartnershipsList innings={innings} nameOf={nameOf} />
      <BallByBallByOver timeline={innings.timeline} />
    </View>
  );
});

export interface LiveScoringScorecardTabProps {
  card: ScorecardResponse;
  match: MatchDetail | null;
}

/**
 * Read-only detailed scorecard for the live scoring screen.
 * Consumes the same `card` feed as the Live tab (engine-derived per innings).
 */
export function LiveScoringScorecardTab({
  card,
  match,
}: LiveScoringScorecardTabProps): React.ReactElement {
  const { user } = useAuth();
  const { nameOf, battingTeamLabel } = useScorecardResolvers(card, match);
  const showInningsTabs = showLiveScorecardInningsTabs(card);
  const [inningsIndex, setInningsIndex] = useState(() => defaultLiveScorecardInningsIndex(card));
  const prevInningsLenRef = useRef(card.innings.length);

  useEffect(() => {
    const prevLen = prevInningsLenRef.current;
    if (card.innings.length > prevLen && prevLen === 1) {
      setInningsIndex(1);
    }
    prevInningsLenRef.current = card.innings.length;
  }, [card.innings.length]);

  const effectiveIndex = showInningsTabs ? inningsIndex : 0;
  const innings = card.innings[effectiveIndex] ?? card.innings[0] ?? null;

  if (!innings) {
    return (
      <View className="rounded-control border border-outline-variant bg-surface-container-low p-4">
        <Text className={LIVE_SCORECARD_TYPE.emptyState}>
          Innings has not started yet.
        </Text>
      </View>
    );
  }

  const teamName = battingTeamLabel(innings).name;

  return (
    <View className="gap-3">
      {showInningsTabs ? (
        <InningsTabs
          size="scorecard"
          tabLabels={LIVE_SCORECARD_INNINGS_TAB_LABELS}
          selectedIndex={effectiveIndex}
          onSelect={setInningsIndex}
        />
      ) : null}

      <InningsScorecardBody
        card={card}
        match={match}
        innings={innings}
        teamName={teamName}
        nameOf={nameOf}
        user={user}
      />
    </View>
  );
}
