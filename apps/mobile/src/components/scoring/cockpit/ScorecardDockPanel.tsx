import {
  formatDismissalShort,
  formatBatterStatus,
  formatBatterStrikeRateDisplay,
  formatBowlerEconomyDisplay,
  extrasBreakdownParts,
  groupTimelineByOver,
  wicketOrdinal,
  type BatterCard,
  type BowlerCard,
  type CompletedPartnership,
  type FallOfWicket,
  type InningsScorecard,
  type ScorecardResponse,
  type SquadPlayerView,
  type TimelineEntry,
  DeliveryType,
} from '@acc/types';
import { Pressable, ScrollView, View } from 'react-native';
import { useMemo, useState } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';

import { Text } from '../../ui/Text';
import { colors } from '../../../theme/colors';
import { recentBallChipStyle } from '../liveScoringKeypadTokens';
import { CockpitPanel } from './CockpitPanel';

type ScorecardDockTab = 'scorecard' | 'partnerships' | 'overs' | 'fow';

const TABS: { id: ScorecardDockTab; label: string }[] = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'partnerships', label: 'Partnerships' },
  { id: 'overs', label: 'Over by Over' },
  { id: 'fow', label: 'Fall of Wickets' },
];

/** Fixed numeric columns — SR must fit "285.71" without wrapping. */
const COL_R = 36;
const COL_B = 36;
const COL_4S = 36;
const COL_6S = 36;
const COL_SR = 56;
const STATS_WIDTH = COL_R + COL_B + COL_4S + COL_6S + COL_SR;

const HEADER_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  borderBottomWidth: 1,
  borderBottomColor: '#e7e5e4',
  backgroundColor: '#f5f5f4',
  paddingHorizontal: 8,
  paddingVertical: 4,
};

const DATA_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(231, 229, 228, 0.4)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  minHeight: 28,
};

const STAT_HEADER: TextStyle = {
  fontSize: 10,
  fontWeight: '600',
  textTransform: 'uppercase',
  color: '#78716c',
  textAlign: 'right',
};

const STAT_VALUE: TextStyle = {
  fontSize: 12,
  color: '#1c1917',
  textAlign: 'right',
  fontVariant: ['tabular-nums'],
};

const STAT_BLANK: TextStyle = {
  ...STAT_VALUE,
  color: '#a8a29e',
};

const SR_VALUE: TextStyle = {
  ...STAT_VALUE,
  width: COL_SR,
  whiteSpace: 'nowrap' as TextStyle['whiteSpace'],
};

/** Play Control parity: O M R W Eco Wd NB — fixed widths, Econ won't wrap. */
const BOWL_O = 40;
const BOWL_M = 32;
const BOWL_R = 36;
const BOWL_W = 32;
const BOWL_ECO = 48;
const BOWL_WD = 32;
const BOWL_NB = 32;
const BOWL_STATS_WIDTH =
  BOWL_O + BOWL_M + BOWL_R + BOWL_W + BOWL_ECO + BOWL_WD + BOWL_NB;

const SECTION_TITLE: ViewStyle = {
  paddingHorizontal: 8,
  paddingTop: 18,
  paddingBottom: 4,
  marginTop: 4,
};

const FOW_WKT = 28;
const FOW_OVER = 44;

function batterCardFor(innings: InningsScorecard, playerId: string): BatterCard | undefined {
  return innings.batters.find((b) => b.playerId === playerId);
}

function FallOfWicketRow({
  fow,
  batter,
  nameOf,
}: {
  fow: FallOfWicket;
  batter: BatterCard | undefined;
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const score = batter ? `${batter.runs} (${batter.balls})` : '—';
  const howOut = batter ? formatDismissalShort(batter, nameOf) || '—' : '—';

  return (
    <View style={DATA_ROW}>
      <Text
        className="font-sans-semibold text-[12px] text-on-surface-variant"
        style={{ width: FOW_WKT, flexShrink: 0 }}
      >
        {fow.wicketNumber}
      </Text>
      <View className="min-w-0 flex-1 flex-row items-baseline gap-1.5">
        <Text className="shrink font-sans text-[12px] text-on-surface" numberOfLines={1}>
          {nameOf(fow.playerId)}
        </Text>
        <Text className="shrink-0 font-sans text-[12px] text-on-surface-variant" numberOfLines={1}>
          {score}
        </Text>
      </View>
      <Text className="min-w-0 flex-1 font-sans text-[11px] text-on-surface-variant" numberOfLines={1}>
        {howOut}
      </Text>
      <StatCell value={fow.oversText} width={FOW_OVER} nowrap />
    </View>
  );
}

/** Bowlers who've delivered ≥1 ball — engine fold order (first appearance). */
function bowlersWhoHaveBowled(innings: InningsScorecard): BowlerCard[] {
  return innings.bowlers.filter(
    (b) => b.legalBalls > 0 || b.wides > 0 || b.noBalls > 0,
  );
}

type BattingRow =
  | {
      kind: 'batted';
      playerId: string;
      card: BatterCard;
    }
  | {
      kind: 'waiting';
      playerId: string;
    };

function partnershipRows(innings: InningsScorecard): CompletedPartnership[] {
  const rows: CompletedPartnership[] = [...innings.partnerships];
  if (innings.partnership) {
    rows.push({
      batterIds: innings.partnership.batterIds,
      batterRuns: innings.partnership.batterRuns,
      runs: innings.partnership.runs,
      balls: innings.partnership.balls,
    });
  }
  if (innings.closed && rows.length > 0) {
    return rows.slice(0, -1);
  }
  return rows;
}

type PartnershipDisplayRow = {
  stand: CompletedPartnership;
  /** 0-based index in crease order (matches timeline stand segments). */
  standIndex: number;
  /** 1-based stand number for “1ST Wicket” labels. */
  standNumber: number;
  isCurrent: boolean;
};

/** Most-recent first; current unbroken stand tagged when the innings is live. */
function partnershipDisplayRows(innings: InningsScorecard): PartnershipDisplayRow[] {
  const stands = partnershipRows(innings);
  const currentIds = innings.partnership?.batterIds ?? null;
  const currentKey = currentIds ? currentIds.join('|') : null;
  const withMeta = stands.map((stand, index) => {
    const isCurrent =
      !innings.closed &&
      currentKey != null &&
      index === stands.length - 1 &&
      stand.batterIds.join('|') === currentKey;
    return { stand, standIndex: index, standNumber: index + 1, isCurrent };
  });
  return withMeta.slice().reverse();
}

function partnershipBatterRuns(
  stand: Pick<CompletedPartnership, 'batterRuns'>,
  batterId: string,
): number {
  return stand.batterRuns.find((row) => row.playerId === batterId)?.runs ?? 0;
}

/** Balls faced (legal / bye / LB / no-ball) — mirrors engine faced-ball rule. */
function timelineEntryCountsAsFaced(entry: TimelineEntry): boolean {
  if (entry.deliveryType != null) {
    return (
      entry.deliveryType === DeliveryType.Legal ||
      entry.deliveryType === DeliveryType.Bye ||
      entry.deliveryType === DeliveryType.LegBye ||
      entry.deliveryType === DeliveryType.NoBall
    );
  }
  const { code } = entry;
  if (code.startsWith('Wd') || code.startsWith('pen') || code === 'RH' || code === 'IMP') {
    return false;
  }
  if (code === 'Drop' || code === 'End' || code === 'Mk') {
    return false;
  }
  return true;
}

/**
 * Per-batter balls faced within a stand, derived from the timeline between wicket
 * boundaries (batterRuns payload has runs only — balls are not stored on the stand).
 */
function partnershipBatterBalls(
  timeline: readonly TimelineEntry[],
  standIndex: number,
  batterId: string,
): number {
  const wicketAt: number[] = [];
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i]?.isWicket) {
      wicketAt.push(i);
    }
  }
  const start = standIndex === 0 ? 0 : (wicketAt[standIndex - 1] ?? -1) + 1;
  const endExclusive =
    standIndex < wicketAt.length ? (wicketAt[standIndex] ?? timeline.length) + 1 : timeline.length;

  let balls = 0;
  for (let i = start; i < endExclusive; i++) {
    const entry = timeline[i];
    if (!entry) continue;
    if (entry.strikerId === batterId && timelineEntryCountsAsFaced(entry)) {
      balls += 1;
    }
  }
  return balls;
}

const BATTER_A_COLOR = colors.primary;
const BATTER_B_COLOR = colors.secondaryDark;
const BATTER_COL_W = 150;

/** Full-width row: 150px | flexible bar | 150px (flex — reliable on RN Web). */
const PARTNERSHIP_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'stretch',
  width: '100%',
  columnGap: 10,
  paddingBottom: 12,
  marginBottom: 4,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(231, 229, 228, 0.5)',
};

const PARTNERSHIP_BATTER_COL: ViewStyle = {
  width: BATTER_COL_W,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: BATTER_COL_W,
};

const PARTNERSHIP_BAR_COL: ViewStyle = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
};

/** Per-over delivery chips — same styling as Play Control "This Over". */
function OverBallChips({ balls }: { balls: readonly string[] }): React.ReactElement {
  if (balls.length === 0) {
    return (
      <Text className="min-w-0 flex-1 font-sans-medium text-[12px] text-on-surface-variant">—</Text>
    );
  }

  return (
    <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
      {balls.map((code, index) => {
        const chip = recentBallChipStyle(code, code === 'W');
        const textSize =
          chip.label.length > 3 ? 'text-[8px]' : chip.label.length > 2 ? 'text-[9px]' : 'text-[10px]';
        return (
          <View
            key={`${index}-${code}`}
            className={`h-6 w-6 items-center justify-center rounded-full ${chip.bgClass}`}
            accessibilityLabel={`Ball ${index + 1}: ${chip.label}`}
          >
            <Text className={`font-sans-bold ${textSize} ${chip.textClass}`} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        );
      })}
    </View>
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
  if (total <= 0) {
    return (
      <View className="w-full">
        <View className="h-6 w-full rounded bg-surface-container" />
        <View className="mt-0.5 w-full flex-row justify-between">
          <Text className="font-sans text-[9px] text-on-surface-variant">0%</Text>
          <Text className="font-sans text-[9px] text-on-surface-variant">0%</Text>
        </View>
      </View>
    );
  }

  const leftPct = Math.round((leftRuns / total) * 100);
  const rightPct = 100 - leftPct;
  const showLeftLabel = leftRuns > 0 && leftPct >= 14;
  const showRightLabel = rightRuns > 0 && rightPct >= 14;

  return (
    <View className="w-full">
      <View className="h-6 w-full flex-row overflow-hidden rounded">
        {leftRuns > 0 ? (
          <View
            className="h-full items-center justify-center px-0.5"
            style={{
              flexGrow: leftRuns,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: rightRuns > 0 ? 4 : undefined,
              backgroundColor: BATTER_A_COLOR,
            }}
          >
            {showLeftLabel ? (
              <Text className="font-sans-bold text-[10px] text-white" numberOfLines={1}>
                {leftRuns}
              </Text>
            ) : null}
          </View>
        ) : null}
        {rightRuns > 0 ? (
          <View
            className="h-full items-center justify-center px-0.5"
            style={{
              flexGrow: rightRuns,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: leftRuns > 0 ? 4 : undefined,
              backgroundColor: BATTER_B_COLOR,
            }}
          >
            {showRightLabel ? (
              <Text className="font-sans-bold text-[10px] text-white" numberOfLines={1}>
                {rightRuns}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View className="mt-0.5 w-full flex-row justify-between">
        <Text className="font-sans text-[9px] text-on-surface-variant">{leftPct}%</Text>
        <Text className="font-sans text-[9px] text-on-surface-variant">{rightPct}%</Text>
      </View>
    </View>
  );
}

function PartnershipContributionRow({
  stand,
  standIndex,
  standNumber,
  isCurrent,
  timeline,
  nameOf,
}: {
  stand: CompletedPartnership;
  standIndex: number;
  standNumber: number;
  isCurrent: boolean;
  timeline: readonly TimelineEntry[];
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const leftId = stand.batterIds[0] ?? null;
  const rightId = stand.batterIds[1] ?? null;
  const leftRuns = leftId ? partnershipBatterRuns(stand, leftId) : 0;
  const rightRuns = rightId ? partnershipBatterRuns(stand, rightId) : 0;
  const leftBalls = leftId ? partnershipBatterBalls(timeline, standIndex, leftId) : 0;
  const rightBalls = rightId ? partnershipBatterBalls(timeline, standIndex, rightId) : 0;
  const leftName = leftId ? nameOf(leftId) : '—';
  const rightName = rightId ? nameOf(rightId) : '—';
  const headerLabel = isCurrent
    ? `${wicketOrdinal(standNumber)} Wicket · Current`
    : `${wicketOrdinal(standNumber)} Wicket`;

  return (
    <View style={PARTNERSHIP_ROW}>
      <View style={[PARTNERSHIP_BATTER_COL, { alignItems: 'flex-end' }]}>
        <Text
          className="w-full text-right font-sans-semibold text-[12px] text-on-surface"
          numberOfLines={1}
        >
          {leftName}
        </Text>
        <Text className="text-right font-sans text-[11px] text-on-surface-variant">
          {leftRuns} ({leftBalls})
        </Text>
      </View>

      <View style={PARTNERSHIP_BAR_COL}>
        <Text className="mb-1.5 text-center font-sans-semibold text-[11px] text-on-surface">
          {headerLabel}
          <Text className="font-sans-bold text-on-surface">
            {' '}
            · {stand.runs} ({stand.balls})
          </Text>
          {isCurrent ? <Text className="font-sans text-[10px] text-primary"> · live</Text> : null}
        </Text>
        <PartnershipContributionBar leftRuns={leftRuns} rightRuns={rightRuns} />
      </View>

      <View style={[PARTNERSHIP_BATTER_COL, { alignItems: 'flex-start' }]}>
        <Text
          className="w-full text-left font-sans-semibold text-[12px] text-on-surface"
          numberOfLines={1}
        >
          {rightName}
        </Text>
        <Text className="text-left font-sans text-[11px] text-on-surface-variant">
          {rightRuns} ({rightBalls})
        </Text>
      </View>
    </View>
  );
}

/** Crease order first, then remaining Playing XI (battingOrder) who have not yet appeared. */
function buildBattingRows(
  innings: InningsScorecard,
  battingXi: readonly SquadPlayerView[],
): BattingRow[] {
  const batted = innings.batters.map(
    (card): BattingRow => ({ kind: 'batted', playerId: card.playerId, card }),
  );
  const seen = new Set(innings.batters.map((b) => b.playerId));
  const waiting = battingXi
    .filter((p) => !seen.has(p.userId))
    .slice()
    .sort((a, b) => (a.battingOrder ?? 999) - (b.battingOrder ?? 999) || a.userId.localeCompare(b.userId))
    .map((p): BattingRow => ({ kind: 'waiting', playerId: p.userId }));
  return [...batted, ...waiting];
}

function StatHeaderCell({
  label,
  width,
}: {
  label: string;
  width: number;
}): React.ReactElement {
  return (
    <Text style={{ ...STAT_HEADER, width }} numberOfLines={1}>
      {label}
    </Text>
  );
}

function StatCell({
  value,
  width,
  blank,
  nowrap,
}: {
  value: string;
  width: number;
  blank?: boolean;
  nowrap?: boolean;
}): React.ReactElement {
  return (
    <Text
      style={{
        ...(blank ? STAT_BLANK : STAT_VALUE),
        width,
        ...(nowrap ? { whiteSpace: 'nowrap' as TextStyle['whiteSpace'] } : null),
      }}
      numberOfLines={1}
    >
      {value}
    </Text>
  );
}

export function ScorecardDockPanel({
  card,
  innings,
  battingXi,
  nameOf,
}: {
  card: ScorecardResponse;
  innings: InningsScorecard;
  battingXi: SquadPlayerView[];
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const [tab, setTab] = useState<ScorecardDockTab>('scorecard');
  const battingRows = useMemo(
    () => buildBattingRows(innings, battingXi),
    [battingXi, innings],
  );
  const bowlingRows = useMemo(() => bowlersWhoHaveBowled(innings), [innings]);
  const partnershipTabRows = useMemo(() => partnershipDisplayRows(innings), [innings]);
  const waitingLabel = innings.closed ? 'did not bat' : 'yet to bat';
  const isLiveInnings = !innings.closed;
  const extrasParts = extrasBreakdownParts(innings.extras);
  const extrasDetail =
    extrasParts.length > 0
      ? extrasParts.join(' ').replace(/w /g, 'w').replace(/b /g, 'b')
      : 'b0 lb0 w0 nb0';

  return (
    <CockpitPanel title="Scorecard" live bodyNoPad>
      <View className="min-w-0 flex-1" style={{ width: '100%' }}>
        <View className="flex-row border-b border-outline-variant bg-surface-container-low">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                className={`px-2.5 py-1.5 ${active ? 'border-b-2 border-secondary bg-surface' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  className={`font-sans text-[11px] ${
                    active ? 'font-sans-semibold text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          className="min-w-0 flex-1"
          style={{ width: '100%' }}
          contentContainerStyle={{
            width: '100%',
            alignSelf: 'stretch',
            paddingBottom: 12,
          }}
        >
          {tab === 'scorecard' ? (
            <View>
              <View style={HEADER_ROW}>
                <Text className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                  Batter
                </Text>
                <Text className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                  How Out
                </Text>
                <View style={{ width: STATS_WIDTH, flexDirection: 'row', flexShrink: 0 }}>
                  <StatHeaderCell label="R" width={COL_R} />
                  <StatHeaderCell label="B" width={COL_B} />
                  <StatHeaderCell label="4s" width={COL_4S} />
                  <StatHeaderCell label="6s" width={COL_6S} />
                  <StatHeaderCell label="SR" width={COL_SR} />
                </View>
              </View>

              {battingRows.map((row) => {
                if (row.kind === 'waiting') {
                  return (
                    <View key={row.playerId} style={DATA_ROW}>
                      <Text
                        className="min-w-0 flex-1 font-sans text-[12px] text-on-surface-variant"
                        numberOfLines={1}
                      >
                        {nameOf(row.playerId)}
                      </Text>
                      <Text
                        className="min-w-0 flex-1 font-sans italic text-[11px] text-on-surface-variant"
                        numberOfLines={1}
                      >
                        {waitingLabel}
                      </Text>
                      <View style={{ width: STATS_WIDTH, flexDirection: 'row', flexShrink: 0 }}>
                        <StatCell value="–" width={COL_R} blank />
                        <StatCell value="–" width={COL_B} blank />
                        <StatCell value="–" width={COL_4S} blank />
                        <StatCell value="–" width={COL_6S} blank />
                        <StatCell value="–" width={COL_SR} blank nowrap />
                      </View>
                    </View>
                  );
                }

                const { card: batter } = row;
                const onStrike =
                  batter.playerId === innings.currentStrikerId && !batter.isOut;
                const atCrease =
                  !batter.isOut &&
                  (batter.playerId === innings.currentStrikerId ||
                    batter.playerId === innings.currentNonStrikerId);

                return (
                  <View key={batter.playerId} style={DATA_ROW}>
                    <Text
                      className={`min-w-0 flex-1 font-sans-semibold text-[12px] ${
                        atCrease ? 'text-primary' : 'text-on-surface'
                      }`}
                      numberOfLines={1}
                    >
                      {nameOf(batter.playerId)}
                      {onStrike ? ' *' : ''}
                    </Text>
                    <Text
                      className="min-w-0 flex-1 font-sans text-[11px] text-on-surface-variant"
                      numberOfLines={1}
                    >
                      {batter.isOut
                        ? formatDismissalShort(batter, nameOf)
                        : formatBatterStatus(batter, nameOf)}
                    </Text>
                    <View style={{ width: STATS_WIDTH, flexDirection: 'row', flexShrink: 0 }}>
                      <StatCell value={String(batter.runs)} width={COL_R} />
                      <StatCell value={String(batter.balls)} width={COL_B} />
                      <StatCell value={String(batter.fours)} width={COL_4S} />
                      <StatCell value={String(batter.sixes)} width={COL_6S} />
                      <Text style={SR_VALUE} numberOfLines={1}>
                        {formatBatterStrikeRateDisplay(batter)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <View className="flex-row border-t border-outline-variant px-2 py-1.5">
                <Text className="min-w-0 flex-1 font-sans-bold text-[12px] text-on-surface">
                  Extras
                </Text>
                <Text className="min-w-0 flex-1 font-sans text-[11px] text-on-surface-variant">
                  {innings.extras.total} ({extrasDetail})
                </Text>
                <View style={{ width: STATS_WIDTH }} />
              </View>
              <View className="flex-row bg-surface-container-low px-2 py-1.5">
                <Text className="min-w-0 flex-1 font-sans-bold text-[12px] text-on-surface">
                  Total
                </Text>
                <Text className="min-w-0 flex-1 font-sans text-[11px] text-on-surface-variant">
                  {innings.wickets} wkts · {innings.oversText} ov
                </Text>
                <View
                  style={{
                    width: STATS_WIDTH,
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <Text className="font-sans-bold text-[12px] text-on-surface">{innings.runs}</Text>
                </View>
              </View>

              <View style={SECTION_TITLE}>
                <Text className="font-sans-bold text-[12px] text-on-surface">Bowling</Text>
              </View>
              <View style={HEADER_ROW}>
                <Text className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                  Bowler
                </Text>
                <View style={{ width: BOWL_STATS_WIDTH, flexDirection: 'row', flexShrink: 0 }}>
                  <StatHeaderCell label="O" width={BOWL_O} />
                  <StatHeaderCell label="M" width={BOWL_M} />
                  <StatHeaderCell label="R" width={BOWL_R} />
                  <StatHeaderCell label="W" width={BOWL_W} />
                  <StatHeaderCell label="Econ" width={BOWL_ECO} />
                  <StatHeaderCell label="Wd" width={BOWL_WD} />
                  <StatHeaderCell label="NB" width={BOWL_NB} />
                </View>
              </View>
              {bowlingRows.length === 0 ? (
                <View style={DATA_ROW}>
                  <Text className="font-sans text-[11px] text-on-surface-variant">
                    No bowlers yet
                  </Text>
                </View>
              ) : (
                bowlingRows.map((bowler) => {
                  const current =
                    isLiveInnings && bowler.playerId === innings.currentBowlerId;
                  return (
                    <View key={bowler.playerId} style={DATA_ROW}>
                      <Text
                        className={`min-w-0 flex-1 font-sans-semibold text-[12px] ${
                          current ? 'text-primary' : 'text-on-surface'
                        }`}
                        numberOfLines={1}
                      >
                        {nameOf(bowler.playerId)}
                        {current ? ' *' : ''}
                      </Text>
                      <View
                        style={{ width: BOWL_STATS_WIDTH, flexDirection: 'row', flexShrink: 0 }}
                      >
                        <StatCell value={bowler.oversText} width={BOWL_O} nowrap />
                        <StatCell value={String(bowler.maidens)} width={BOWL_M} />
                        <StatCell value={String(bowler.runsConceded)} width={BOWL_R} />
                        <StatCell value={String(bowler.wickets)} width={BOWL_W} />
                        <StatCell
                          value={formatBowlerEconomyDisplay(bowler)}
                          width={BOWL_ECO}
                          nowrap
                        />
                        <StatCell value={String(bowler.wides)} width={BOWL_WD} />
                        <StatCell value={String(bowler.noBalls)} width={BOWL_NB} />
                      </View>
                    </View>
                  );
                })
              )}

              {card.result.note ? (
                <Text className="px-2 pt-2 font-sans text-[11px] text-on-surface-variant">
                  {card.result.note}
                </Text>
              ) : null}
            </View>
          ) : null}

          {tab === 'partnerships' ? (
            <View className="w-full px-2 pt-2">
              {partnershipTabRows.length === 0 ? (
                <Text className="py-6 text-center font-sans text-xs text-on-surface-variant">
                  No partnerships yet
                </Text>
              ) : (
                <View className="w-full gap-1">
                  {partnershipTabRows.map((row) => (
                    <PartnershipContributionRow
                      key={`${row.stand.batterIds.join('-')}-${row.standNumber}`}
                      stand={row.stand}
                      standIndex={row.standIndex}
                      standNumber={row.standNumber}
                      isCurrent={row.isCurrent}
                      timeline={innings.timeline}
                      nameOf={nameOf}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {tab === 'overs' ? (
            <View className="px-2 pt-2">
              {groupTimelineByOver(innings.timeline).map((over) => (
                <View key={over.overNumber} className="flex-row items-center gap-2 py-1">
                  <Text className="w-16 shrink-0 font-sans-semibold text-[12px] text-on-surface">
                    Ov {over.overNumber}
                  </Text>
                  <OverBallChips balls={over.balls} />
                  <Text className="shrink-0 font-sans text-[12px] text-on-surface-variant">
                    {over.runs}/{over.wickets}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'fow' ? (
            <View>
              {innings.fallOfWickets.length === 0 ? (
                <Text className="py-6 text-center font-sans text-xs text-on-surface-variant">
                  No wickets yet
                </Text>
              ) : (
                <>
                  <View style={HEADER_ROW}>
                    <Text
                      className="font-sans-semibold text-[10px] uppercase text-on-surface-variant"
                      style={{ width: FOW_WKT, flexShrink: 0 }}
                    >
                      #
                    </Text>
                    <Text className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                      Batter
                    </Text>
                    <Text className="min-w-0 flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                      How Out
                    </Text>
                    <StatHeaderCell label="Over" width={FOW_OVER} />
                  </View>
                  {innings.fallOfWickets.map((fow) => (
                    <FallOfWicketRow
                      key={fow.wicketNumber}
                      fow={fow}
                      batter={batterCardFor(innings, fow.playerId)}
                      nameOf={nameOf}
                    />
                  ))}
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </CockpitPanel>
  );
}
