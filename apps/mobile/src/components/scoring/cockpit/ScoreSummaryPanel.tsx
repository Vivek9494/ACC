import {
  formatBowlerEconomyDisplay,
  formatMatchTossSummaryLine,
  type BatterCard,
  type BowlerCard,
  type InningsScorecard,
  type MatchDetail,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import type { ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { FIELD_ORANGE } from '../../ui/fieldStyles';
import { colors } from '../../../theme/colors';
import { recentBallChipStyle } from '../liveScoringKeypadTokens';
import { BatterInlineSelect } from './BatterInlineSelect';
import {
  BOWLER_PLAY_CONTROL_DROPDOWN_W,
  BowlerInlineSelect,
} from './BowlerInlineSelect';
import { CockpitPanel } from './CockpitPanel';
import {
  currentOverSummary,
  currentRunRate,
  lastFiveOversLine,
  lastWicketLine,
  oversRemainingText,
  partnershipBoundaryCounts,
} from './cockpit-stats';

export interface ScoreSummaryPanelProps {
  matchId: string;
  match: MatchDetail;
  innings: InningsScorecard;
  battingTeamName: string;
  bowlingTeamName: string;
  nameOf: (id: string | null) => string;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  strikerCard: BatterCard | undefined;
  nonStrikerCard: BatterCard | undefined;
  bowlerCard: BowlerCard | undefined;
  /** Desktop inline select — same setInningsParticipants path as the mobile picker. */
  onSelectStriker: (userId: string) => void;
  onSelectNonStriker: (userId: string) => void;
  onSelectBowler: (userId: string) => void;
  /** Live undo last delivery (same as keyboard Backspace). */
  onUndo: () => void;
  working?: boolean;
}

const SUMMARY_TOP: ViewStyle = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 22,
};

const SUMMARY_LEFT: ViewStyle = {
  flex: 1,
  minWidth: 0,
};

const SUMMARY_STATS: ViewStyle = {
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto',
  minWidth: 188,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingLeft: 20,
  borderLeftWidth: 1,
  borderLeftColor: '#e7e5e4',
};

const STAT_ROW: ViewStyle = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 16,
};

/** Two equal Play Control columns (NV Play shape). */
const PLAY_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
  marginTop: 10,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#e7e5e4',
} as ViewStyle;

const PLAY_COL: ViewStyle = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

/** Fixed-width numeric columns so R/B/4/6 and O/M/R/W line up. */
const STAT_CELL_W = 28;
/** Left column — fits "Non-Striker"; keeps batter dropdowns aligned. */
const ROW_LABEL_W = 80;
/** Right Play Control column — shorter labels sit flush to dropdowns. */
const ROW_LABEL_W_RIGHT = 70;
/** Mid-grey — clearly legible header tone (not the faintest variant). */
const HEADER_LABEL_COLOR = '#6B7280';

const STAT_BLOCK: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  flexShrink: 0,
};

const ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  minHeight: 33,
};

const ROW_RIGHT: ViewStyle = {
  ...ROW,
  gap: 2,
};

const HEADER_BAND: ViewStyle = {
  ...ROW,
  minHeight: 18,
  paddingBottom: 0,
  marginBottom: -6,
  justifyContent: 'flex-end',
};

function StatRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={STAT_ROW}>
      <Text className="shrink-0 font-sans text-[11px] text-on-surface-variant">{label}</Text>
      <Text
        className="min-w-0 text-right font-sans-semibold text-[11px] text-on-surface"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function RowLabel({
  label,
  compact,
}: {
  label: string;
  /** Right column — narrower fixed label width, text right-aligned. */
  compact?: boolean;
}): React.ReactElement {
  const width = compact ? ROW_LABEL_W_RIGHT : ROW_LABEL_W;
  return (
    <Text
      style={{
        width,
        textAlign: compact ? 'right' : 'left',
      }}
      className="shrink-0 font-sans text-[10px] uppercase tracking-wide text-on-surface-variant"
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

/**
 * Stat-column header band. `iconSlots` reserves the same width as trailing
 * icon buttons on data rows so labels sit exactly over R/B/4/6 or O/M/R/W.
 */
function StatHeader({
  labels,
  iconSlots,
  labelWidth = ROW_LABEL_W,
  cellWidths,
}: {
  labels: readonly string[];
  iconSlots: number;
  labelWidth?: number;
  cellWidths?: readonly number[];
}): React.ReactElement {
  return (
    <View style={HEADER_BAND}>
      <View style={{ width: labelWidth }} />
      <View style={{ flex: 1 }} />
      {Array.from({ length: iconSlots }, (_, i) => (
        <View key={i} style={{ width: 28, height: 1 }} />
      ))}
      <View style={STAT_BLOCK}>
        {labels.map((label, index) => (
          <Text
            key={label}
            style={{
              width: cellWidths?.[index] ?? STAT_CELL_W,
              color: HEADER_LABEL_COLOR,
              fontSize: 10,
              fontWeight: '700',
              textAlign: 'right',
            }}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BowlerFiguresGrid({
  mode,
  values,
}: {
  mode: 'header' | 'values';
  values?: readonly (string | number)[];
}): React.ReactElement {
  const cells =
    mode === 'header' ? BOWLER_STAT_LABELS : (values ?? []).map((value) => String(value));

  return (
    <View style={BOWLER_FIGURES_GRID}>
      {cells.map((cell, index) => (
        <Text
          key={mode === 'header' ? cell : `${index}-${cell}`}
          className={`w-full text-right ${
            mode === 'header'
              ? 'font-sans text-[10px] font-bold'
              : 'font-sans-semibold text-[11px] text-on-surface'
          }`}
          style={mode === 'header' ? { color: HEADER_LABEL_COLOR } : undefined}
          numberOfLines={1}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

function StatValues({
  values,
  cellWidths,
}: {
  values: readonly (string | number)[];
  cellWidths?: readonly number[];
}): React.ReactElement {
  return (
    <View style={STAT_BLOCK}>
      {values.map((value, index) => (
        <Text
          key={index}
          style={{ width: cellWidths?.[index] ?? STAT_CELL_W }}
          className="text-right font-sans-semibold text-[11px] text-on-surface"
          numberOfLines={1}
        >
          {value}
        </Text>
      ))}
    </View>
  );
}

/** Current-over delivery chips — same colour mapping as mobile RecentBallsStrip. */
function ThisOverBalls({ balls }: { balls: readonly string[] }): React.ReactElement {
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

function batterStats(card: BatterCard | undefined): (string | number)[] {
  if (!card) return ['—', '—', '—', '—'];
  return [card.runs, card.balls, card.fours, card.sixes];
}

function bowlerStats(card: BowlerCard | undefined): (string | number)[] {
  if (!card) return ['—', '—', '—', '—', '—', '—', '—'];
  return [
    card.oversText,
    card.maidens,
    card.runsConceded,
    card.wickets,
    formatBowlerEconomyDisplay(card),
    card.wides,
    card.noBalls,
  ];
}

function UndoIconBtn({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Undo last ball"
      className={`h-7 w-7 items-center justify-center rounded border border-outline-variant bg-surface-container-lowest ${
        disabled ? 'opacity-40' : 'active:opacity-80'
      }`}
    >
      <Ionicons
        name="arrow-undo"
        size={14}
        color={disabled ? colors.textMuted : FIELD_ORANGE}
      />
    </Pressable>
  );
}

export function ScoreSummaryPanel({
  matchId,
  match,
  innings,
  battingTeamName,
  bowlingTeamName,
  nameOf,
  strikerId,
  nonStrikerId,
  bowlerId,
  strikerCard,
  nonStrikerCard,
  bowlerCard,
  onSelectStriker,
  onSelectNonStriker,
  onSelectBowler,
  onUndo,
  working,
}: ScoreSummaryPanelProps): React.ReactElement {
  const toss = formatMatchTossSummaryLine(match);
  const strikerName = strikerId ? nameOf(strikerId) : 'Select striker';
  const nonStrikerName = nonStrikerId ? nameOf(nonStrikerId) : 'Select non-striker';
  const bowlerName = bowlerId ? nameOf(bowlerId) : 'Select bowler';
  const thisOverBalls = currentOverSummary(innings)?.balls ?? [];
  const partnership = innings.partnership;
  const partnershipBounds = partnershipBoundaryCounts(innings);
  const partnershipStats: (string | number)[] = partnership
    ? [partnership.runs, partnership.balls, partnershipBounds.fours, partnershipBounds.sixes]
    : ['—', '—', '—', '—'];

  const inningsId = innings.inningsId ?? '';

  return (
    <CockpitPanel title="Score Summary & Play Control" live fitContent>
      <View style={SUMMARY_TOP}>
        <View style={SUMMARY_LEFT}>
          <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Text
              className="min-w-0 max-w-full font-sans-bold text-xl text-on-surface"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {battingTeamName}
            </Text>
            <Text className="font-sans-bold text-xl text-primary">
              {innings.runs}/{innings.wickets}
            </Text>
            <Text className="font-sans text-sm text-on-surface-variant">({innings.oversText})</Text>
          </View>
          <Text className="mt-0.5 font-sans text-xs text-on-surface-variant" numberOfLines={1}>
            {innings.sequence > 1 && innings.target != null
              ? `Target ${innings.target}`
              : `${bowlingTeamName} to bat`}
          </Text>
          {toss ? (
            <Text className="mt-0.5 font-sans text-xs text-on-surface-variant" numberOfLines={1}>
              Toss: {toss}
            </Text>
          ) : null}
        </View>

        <View style={SUMMARY_STATS}>
          <StatRow label="Run Rate" value={currentRunRate(innings)} />
          <StatRow label="Last 5 Overs" value={lastFiveOversLine(innings)} />
          <StatRow
            label="Last Wicket"
            value={lastWicketLine(innings.fallOfWickets.at(-1), nameOf)}
          />
          <StatRow label="Overs Rem." value={oversRemainingText(innings)} />
        </View>
      </View>

      <View style={PLAY_GRID}>
        {/* LEFT — batters R B 4 6 */}
        <View style={PLAY_COL}>
          <StatHeader labels={['R', 'B', '4', '6']} iconSlots={0} />

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="Striker" />
            <BatterInlineSelect
              matchId={matchId}
              inningsId={inningsId}
              role="striker"
              otherSlotUserId={nonStrikerId}
              displayName={strikerName}
              selectedUserId={strikerId}
              onSelect={onSelectStriker}
            />
            <StatValues values={batterStats(strikerCard)} />
          </View>

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="Non-Striker" />
            <BatterInlineSelect
              matchId={matchId}
              inningsId={inningsId}
              role="nonStriker"
              otherSlotUserId={strikerId}
              displayName={nonStrikerName}
              selectedUserId={nonStrikerId}
              onSelect={onSelectNonStriker}
            />
            <StatValues values={batterStats(nonStrikerCard)} />
          </View>

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="Partnership" />
            <View style={{ flex: 1 }} />
            <StatValues values={partnershipStats} />
          </View>
        </View>

        {/* RIGHT — bowler figures + over/ball + this over */}
        <View style={PLAY_COL}>
          <View style={BOWLER_FIGURES_HEADER_ROW}>
            <View style={{ width: ROW_LABEL_W_RIGHT }} />
            <View style={{ width: BOWLER_PLAY_CONTROL_DROPDOWN_W }} />
            <BowlerFiguresGrid mode="header" />
          </View>

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="Bowler" compact />
            <BowlerInlineSelect
              matchId={matchId}
              inningsId={inningsId}
              displayName={bowlerName}
              selectedUserId={bowlerId}
              onSelect={onSelectBowler}
              width={BOWLER_PLAY_CONTROL_DROPDOWN_W}
            />
            <BowlerFiguresGrid mode="values" values={bowlerStats(bowlerCard)} />
          </View>

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="Over/Ball" compact />
            <View className="min-h-[28px] min-w-[72px] items-center justify-center rounded border border-outline-variant bg-surface-container-lowest px-2">
              <Text className="font-sans-semibold text-[12px] text-on-surface">{innings.oversText}</Text>
            </View>
            <UndoIconBtn onPress={onUndo} disabled={working} />
            <View style={{ flex: 1 }} />
          </View>

          <View style={ROW_LABEL_GAP}>
            <RowLabel label="This Over" compact />
            <ThisOverBalls balls={thisOverBalls} />
          </View>
        </View>
      </View>
    </CockpitPanel>
  );
}
