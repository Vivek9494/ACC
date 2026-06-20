import {
  deriveLiveInningsRunStats,
  formatBatterHeaderFigures,
  formatBatterStatus,
  formatBatterStrikeRateDisplay,
  formatFallOfWicketDetail,
  formatFallOfWicketHeadline,
  formatDismissalShort,
  extrasBreakdownParts,
  type BatterCard,
  type CompletedPartnership,
  type InningsScorecard,
  type ScorecardResponse,
  partnershipRunRate,
} from '@acc/types';
import { useState } from 'react';
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import type { NameResolver } from './LiveScorecard';
import {
  SCORECARD_NAME_COLUMN_GAP,
  SCORECARD_STAT_COLS,
  SCORECARD_TABLE_HORIZONTAL_INSET,
  scorecardBattingStatsTotalWidth,
  scorecardPlayerNameColumnWidth,
  scorecardStatWidth,
} from './scorecardTableWidths';
import { BowlerFiguresScrollTable } from './scoring/BowlerFiguresScrollTable';
import { RecentBallsStrip } from './scoring/RecentBallsStrip';
import { TeamAvatar } from './ui/TeamAvatar';
import { Text } from './ui/Text';
import { INPUT_SHADOW_STYLE } from './ui/fieldStyles';

export interface InningsScorecardViewProps {
  card: ScorecardResponse;
  innings: InningsScorecard;
  nameOf: NameResolver;
  teamNameOf: NameResolver;
  teamLogoUrl?: string | null;
}

function inningsTeamMeta(
  card: ScorecardResponse,
  innings: InningsScorecard,
  teamNameOf: NameResolver,
  teamLogoUrl?: string | null,
): { battingTeamName: string; logoUrl: string | null } {
  const inningsDisplay = card.display?.innings.find((row) => row.inningsId === innings.inningsId);
  return {
    battingTeamName:
      inningsDisplay?.battingTeamName ??
      (innings.battingTeamId ? teamNameOf(innings.battingTeamId) : teamNameOf(null)),
    logoUrl: teamLogoUrl ?? inningsDisplay?.battingTeamLogoUrl ?? null,
  };
}

export interface InningsLiveTopCardsProps {
  card: ScorecardResponse;
  innings: InningsScorecard;
  nameOf: NameResolver;
  teamNameOf: NameResolver;
  totalOvers: number | null;
  teamLogoUrl?: string | null;
  showLiveBadge?: boolean;
}

/** Live match state pinned above innings tabs — always reflects the current live innings. */
export function InningsLiveTopCards({
  card,
  innings,
  nameOf,
  teamNameOf,
  totalOvers,
  teamLogoUrl,
  showLiveBadge = true,
}: InningsLiveTopCardsProps): React.ReactElement {
  const { battingTeamName, logoUrl } = inningsTeamMeta(card, innings, teamNameOf, teamLogoUrl);

  return (
    <View className="gap-4">
      <ScoreHeader
        innings={innings}
        nameOf={nameOf}
        battingTeamName={battingTeamName}
        totalOvers={totalOvers}
        teamLogoUrl={logoUrl}
        showLiveBadge={showLiveBadge}
        showLiveContext
      />
      <PartnershipCard innings={innings} nameOf={nameOf} />
      <LastWicketCard innings={innings} nameOf={nameOf} />
    </View>
  );
}

const BATTING_STAT_COLS = SCORECARD_STAT_COLS;
type BattingStatCol = (typeof BATTING_STAT_COLS)[number];

/** Right inset for Extras / Total values inside the summary rows. */
const BATTING_SUMMARY_VALUE_PADDING_RIGHT = 5;

function battingStatWidth(col: BattingStatCol): number {
  return scorecardStatWidth(col);
}

function BattingStatsHeader(): React.ReactElement {
  return (
    <View className="shrink-0 flex-row">
      {BATTING_STAT_COLS.map((col) => (
        <Text
          key={col}
          style={{ width: battingStatWidth(col) }}
          className="text-right font-sans-semibold text-[10px] uppercase tracking-wide text-on-surface-variant"
        >
          {col}
        </Text>
      ))}
    </View>
  );
}

function BattingStatsCells({
  batter,
  figureClass,
}: {
  batter: BatterCard;
  figureClass: string;
}): React.ReactElement {
  const values: Record<BattingStatCol, string | number> = {
    R: batter.runs,
    B: batter.balls,
    '4s': batter.fours,
    '6s': batter.sixes,
    SR: formatBatterStrikeRateDisplay(batter),
  };

  return (
    <View className="shrink-0 flex-row">
      {BATTING_STAT_COLS.map((col) => (
        <Text
          key={col}
          style={{ width: battingStatWidth(col) }}
          numberOfLines={1}
          className={`text-right ${figureClass}`}
        >
          {values[col]}
        </Text>
      ))}
    </View>
  );
}

/** Shared right-aligned column for Extras / Total summary values. */
function BattingSummaryValues({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View
      className="shrink-0 items-end"
      style={{
        width: scorecardBattingStatsTotalWidth(),
        paddingRight: BATTING_SUMMARY_VALUE_PADDING_RIGHT,
      }}
    >
      {children}
    </View>
  );
}

const WHITE_CARD = 'rounded-control border border-outline-variant bg-surface-container-lowest p-4';

function SectionCard({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <View className={`gap-3 ${WHITE_CARD} ${className}`} style={INPUT_SHADOW_STYLE}>
      {title ? (
        <Text className="font-sans-bold text-base text-on-surface">{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

function LiveBadge(): React.ReactElement {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1">
      <View className="h-2 w-2 rounded-full bg-secondary-900" />
      <Text className="font-sans-semibold text-xs text-secondary-900">LIVE</Text>
    </View>
  );
}

function ScoreHeaderDivider(): React.ReactElement {
  return <View className="h-0.75 bg-separator" />;
}

function CreaseBatterLine({
  name,
  card,
  onStrike,
}: {
  name: string;
  card: BatterCard;
  onStrike: boolean;
}): React.ReactElement {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="shrink font-sans-semibold text-sm text-on-surface" numberOfLines={1}>
        {name}
      </Text>
      {onStrike ? <View className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
      <Text className="shrink-0 font-sans text-sm text-on-surface">
        {formatBatterHeaderFigures(card, onStrike)}
      </Text>
    </View>
  );
}

function ScoreHeader({
  innings,
  nameOf,
  battingTeamName,
  totalOvers,
  teamLogoUrl,
  showLiveBadge = false,
  showLiveContext = false,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
  battingTeamName: string;
  totalOvers: number | null;
  teamLogoUrl?: string | null;
  showLiveBadge?: boolean;
  showLiveContext?: boolean;
}): React.ReactElement {
  const stats = deriveLiveInningsRunStats(innings, totalOvers ?? innings.oversAllotted);
  const striker = innings.batters.find((b) => b.playerId === innings.currentStrikerId);
  const nonStriker = innings.batters.find((b) => b.playerId === innings.currentNonStrikerId);
  const crease: { card: BatterCard; onStrike: boolean }[] = [];
  if (striker && !striker.isOut) {
    crease.push({ card: striker, onStrike: true });
  }
  if (nonStriker && !nonStriker.isOut && nonStriker.playerId !== striker?.playerId) {
    crease.push({ card: nonStriker, onStrike: false });
  }

  const showProjection =
    showLiveContext && !innings.closed && stats.ratesReady && !stats.isChase;
  const showChase = showLiveContext && !innings.closed && stats.isChase && stats.chaseNeedsLine != null;
  const showCrease = showLiveContext && crease.length > 0;

  return (
    <View
      className="overflow-hidden rounded-control bg-surface border-l-4 border-l-primary"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="gap-3 p-4">
        {/* 1. Team row — logo + name | score + overs */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <TeamAvatar name={battingTeamName} logoUrl={teamLogoUrl} size="sm" />
            <Text className="min-w-0 flex-1 font-sans-bold text-xl text-on-surface" numberOfLines={2}>
              {battingTeamName}
            </Text>
          </View>
          <View className="items-end gap-0.5">
            {showLiveBadge ? <LiveBadge /> : null}
            <Text className="font-sans-bold text-4xl leading-none text-primary">
              {innings.runs}/{innings.wickets}
            </Text>
            <Text className="font-sans-semibold text-[11px] uppercase tracking-wider text-on-surface-variant">
              {innings.oversText} Overs
            </Text>
          </View>
        </View>

        {(showCrease || showProjection || showChase) && <ScoreHeaderDivider />}

        {/* 3. Batters + projected / chase */}
        {showCrease || showProjection || showChase ? (
          <View className="flex-row items-start justify-between gap-4">
            {/* Two batters: stacked single-line rows (left) | projected/chase (right) */}
            <View className="min-w-0 flex-1 gap-2">
              {showCrease
                ? crease.map(({ card, onStrike }) => (
                    <CreaseBatterLine
                      key={card.playerId}
                      name={nameOf(card.playerId)}
                      card={card}
                      onStrike={onStrike}
                    />
                  ))
                : null}
            </View>
            {showProjection ? (
              <View className="items-end gap-0.5">
                <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-secondary">
                  Projected
                </Text>
                <Text className="font-sans-bold text-4xl leading-none text-secondary">
                  {stats.projectedAtCurrent}
                </Text>
                <Text className="font-sans-medium text-xs text-on-surface-variant">
                  @ {stats.crrText} rpo
                </Text>
              </View>
            ) : null}
            {showChase ? (
              <View className="max-w-[45%] items-end gap-0.5">
                <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-secondary">
                  Chase
                </Text>
                <Text className="text-right font-sans-semibold text-sm text-on-surface">
                  {stats.chaseNeedsLine}
                </Text>
                {stats.rrrText ? (
                  <Text className="font-sans-bold text-2xl leading-none text-secondary">
                    RRR {stats.rrrText}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {showLiveContext && innings.timeline.length > 0 ? (
          <>
            <ScoreHeaderDivider />
            <RecentBallsStrip timeline={innings.timeline} compact showLabel={false} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function PartnershipCard({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
}): React.ReactElement | null {
  if (!innings.partnership) {
    return null;
  }
  const { runs, balls, batterIds, batterRuns } = innings.partnership;
  const rr = partnershipRunRate(runs, balls);
  return (
    <View
      className="flex-row items-center justify-between gap-4 rounded-control border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface">
          Current partnership
        </Text>
        <Text className="mt-[5px] font-sans-bold text-4xl leading-none text-on-surface">
          {runs}
          <Text className="font-sans-bold text-xl text-on-surface"> Runs</Text>
        </Text>
        <Text className="font-sans-medium text-sm text-on-surface">
          ({balls} balls)
          <Text className="font-sans-medium text-on-surface-variant"> • </Text>
          <Text className="font-sans-semibold text-secondary">RR {rr.toFixed(1)}</Text>
        </Text>
      </View>
      <View className="shrink-0 gap-1">
        {[...new Set(batterIds)].map((id) => {
          const contribution = batterRuns.find((row) => row.playerId === id)?.runs ?? 0;
          const onStrike = id === innings.currentStrikerId;
          return (
            <View key={id} className="flex-row items-center justify-end gap-2">
              <Text
                className={`max-w-[120px] font-sans-semibold text-xs ${onStrike ? 'text-primary' : 'text-on-surface'}`}
                numberOfLines={1}
              >
                {nameOf(id)}
              </Text>
              <Text
                className={`min-w-[24px] text-right font-sans-bold text-sm ${onStrike ? 'text-primary' : 'text-on-surface'}`}
              >
                {contribution}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LastWicketCard({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
}): React.ReactElement | null {
  const last = innings.fallOfWickets.at(-1);
  if (!last) {
    return null;
  }
  const batter = innings.batters.find((b) => b.playerId === last.playerId);
  if (!batter) {
    return null;
  }
  const figures = `${batter.runs} (${batter.balls})`;
  const dismissal = formatDismissalShort(batter, nameOf);
  return (
    <View
      className="gap-2 rounded-control bg-secondary-container p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-bold text-base text-on-secondary-container">Last wicket</Text>
      <Text className="font-sans-semibold text-base text-on-secondary-container">
        {nameOf(batter.playerId)} {figures}
      </Text>
      {dismissal ? (
        <Text className="font-sans text-sm text-on-secondary-container">• {dismissal}</Text>
      ) : null}
    </View>
  );
}

function BattingTable({
  innings,
  nameOf,
  teamName,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
  teamName: string;
}): React.ReactElement {
  const isLive = !innings.closed;
  const extrasParts = extrasBreakdownParts(innings.extras);
  const extrasLabel =
    extrasParts.length > 0 ? `Extras (${extrasParts.join(', ')})` : 'Extras';

  const figureClass = (highlight: boolean): string =>
    highlight
      ? 'font-sans-semibold text-xs text-primary'
      : 'font-sans text-xs text-on-surface';

  return (
    <SectionCard title={`${teamName} innings scorecard`}>
      <Text className="font-sans-bold text-base text-on-surface">Batting</Text>

      <View className="flex-row items-end justify-between border-b border-outline-variant pb-2 pt-1">
        <Text className="font-sans-semibold text-[10px] uppercase tracking-wide text-on-surface-variant">
          Batsman
        </Text>
        <BattingStatsHeader />
      </View>

      {innings.batters.map((batter) => {
        const onStrike = batter.playerId === innings.currentStrikerId;
        const notOut = !batter.isOut;
        const liveRow = isLive && notOut;
        const statusText = formatBatterStatus(batter, nameOf);
        const nameClass = liveRow
          ? 'font-sans-semibold text-sm text-primary'
          : 'font-sans-semibold text-sm text-on-surface';
        const statusClass = liveRow
          ? 'font-sans text-[11px] text-primary'
          : 'font-sans text-[11px] text-on-surface-variant';

        return (
          <View
            key={batter.playerId}
            className="flex-row items-start justify-between border-b border-separator py-2"
          >
            <View className="min-w-0 flex-1" style={{ paddingRight: SCORECARD_NAME_COLUMN_GAP }}>
              <Text className={nameClass}>
                {nameOf(batter.playerId)}
                {liveRow && onStrike ? ' ★' : ''}
              </Text>
              <Text className={`mt-0.5 ${statusClass}`}>{statusText}</Text>
            </View>
            <BattingStatsCells batter={batter} figureClass={figureClass(liveRow)} />
          </View>
        );
      })}

      <View className="rounded-control bg-surface-container-low px-2 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="min-w-0 flex-1 pr-3 font-sans text-sm text-on-surface-variant" numberOfLines={2}>
            {extrasLabel}
          </Text>
          <BattingSummaryValues>
            <Text className="text-right font-sans-semibold text-sm text-on-surface">
              {innings.extras.total}
            </Text>
          </BattingSummaryValues>
        </View>
      </View>

      <View className="rounded-control bg-surface-container-low px-2 py-2.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-sm text-on-surface">TOTAL</Text>
          <BattingSummaryValues>
            <Text className="text-right font-sans-bold text-base text-on-surface">
              {innings.runs}/{innings.wickets}
            </Text>
            <Text className="text-right font-sans text-sm text-on-surface-variant">
              ({innings.oversText})
            </Text>
          </BattingSummaryValues>
        </View>
      </View>
    </SectionCard>
  );
}

function BowlingTable({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
}): React.ReactElement | null {
  const { width: screenWidth } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(
    () => screenWidth - SCORECARD_TABLE_HORIZONTAL_INSET,
  );

  if (innings.bowlers.length === 0) {
    return null;
  }

  const onLayout = (event: LayoutChangeEvent): void => {
    const width = event.nativeEvent.layout.width;
    setContentWidth((prev) => (prev === width ? prev : width));
  };

  const nameColumnWidth = scorecardPlayerNameColumnWidth(contentWidth);

  return (
    <SectionCard>
      <Text className="mb-2 font-sans-semibold text-sm text-on-surface-variant">Bowling</Text>
      <View onLayout={onLayout}>
        <BowlerFiguresScrollTable
          scorecardNameColumnWidth={nameColumnWidth}
          rows={innings.bowlers.map((bowler) => {
            const isCurrent = bowler.playerId === innings.currentBowlerId;
            return {
              id: bowler.playerId,
              name: nameOf(bowler.playerId),
              card: bowler,
              highlightName: isCurrent,
              nameSuffix: isCurrent ? '*' : '',
            };
          })}
        />
      </View>
    </SectionCard>
  );
}

function FallOfWicketsSection({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
}): React.ReactElement | null {
  if (innings.fallOfWickets.length === 0) {
    return null;
  }
  return (
    <SectionCard title="Fall of Wickets">
      <View className="gap-2">
        {innings.fallOfWickets.map((fow) => (
          <View
            key={fow.wicketNumber}
            className="gap-1 rounded-control bg-surface-container-low px-3 py-2.5"
          >
            <Text className="font-sans-bold text-sm uppercase text-primary">
              {formatFallOfWicketHeadline(fow)}
            </Text>
            <Text className="font-sans text-sm text-on-surface">
              {formatFallOfWicketDetail(fow, nameOf)}
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
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

function partnershipBatterRuns(
  stand: Pick<CompletedPartnership, 'batterRuns'>,
  batterId: string,
): number {
  return stand.batterRuns.find((row) => row.playerId === batterId)?.runs ?? 0;
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

function PartnershipRow({
  stand,
  nameOf,
}: {
  stand: CompletedPartnership;
  nameOf: NameResolver;
}): React.ReactElement {
  const leftId = stand.batterIds[0];
  const rightId = stand.batterIds[1];
  const leftRuns = leftId ? partnershipBatterRuns(stand, leftId) : 0;
  const rightRuns = rightId ? partnershipBatterRuns(stand, rightId) : 0;

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center">
        <Text className="min-w-0 flex-1 font-sans text-sm text-on-surface" numberOfLines={1}>
          {leftId ? `${nameOf(leftId)} (${leftRuns})` : ''}
        </Text>
        <Text className="shrink-0 px-1.5 text-center font-sans-bold text-sm text-primary">
          {stand.runs} ({stand.balls})
        </Text>
        <Text
          className="min-w-0 flex-1 text-right font-sans text-sm text-on-surface"
          numberOfLines={1}
        >
          {rightId ? `${nameOf(rightId)} (${rightRuns})` : ''}
        </Text>
      </View>
      {leftId && rightId ? (
        <PartnershipContributionBar leftRuns={leftRuns} rightRuns={rightRuns} />
      ) : null}
    </View>
  );
}

function PartnershipsSection({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: NameResolver;
}): React.ReactElement | null {
  const stands = buildPartnershipStandRows(innings);
  if (stands.length === 0) {
    return null;
  }
  return (
    <SectionCard title="Partnerships">
      <View className="gap-4">
        {stands.map((stand, index) => (
          <PartnershipRow
            key={`${stand.batterIds.join('-')}-${index}`}
            stand={stand}
            nameOf={nameOf}
          />
        ))}
      </View>
    </SectionCard>
  );
}

/** Per-innings scorecard body (batting, bowling, FoW, partnerships) — tab-selected. */
export function InningsScorecardView({
  card,
  innings,
  nameOf,
  teamNameOf,
  teamLogoUrl,
}: InningsScorecardViewProps): React.ReactElement {
  const { battingTeamName } = inningsTeamMeta(card, innings, teamNameOf, teamLogoUrl);

  return (
    <View className="gap-4">
      <BattingTable innings={innings} nameOf={nameOf} teamName={battingTeamName} />
      <BowlingTable innings={innings} nameOf={nameOf} />
      <FallOfWicketsSection innings={innings} nameOf={nameOf} />
      <PartnershipsSection innings={innings} nameOf={nameOf} />
      {card.result.decided && innings.closed ? (
        <View className={`${WHITE_CARD}`} style={INPUT_SHADOW_STYLE}>
          <Text className="font-sans-bold text-sm text-primary">
            {teamNameOf(card.result.winningTeamId)} won
            {card.result.note ? ` · ${card.result.note}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
