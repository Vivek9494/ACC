import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  BallType,
  formatBatterStrikeRateDisplay,
  type BatterCard,
  type BowlerCard,
  type ExtrasBreakdown,
} from '@acc/types';
import { Pressable, View } from 'react-native';

import { LiveScoringBowlerTable } from './LiveScoringBowlerTable';
import type { BowlerFiguresRow } from './BowlerFiguresScrollTable';
import { LIVE_BOWLING_HEADER_HEIGHT } from './BowlerFiguresScrollTable';
import { BallTypeIcon } from '../ui/BallTypeIcon';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

/** Fixed stat column widths — keeps each batter on one row on narrow screens. */
const LIVE_BATTING_RUNS_COL_WIDTH = 46;
const LIVE_BATTING_BOUNDARY_COL_WIDTH = 24;
const LIVE_BATTING_SR_COL_WIDTH = 34;

const BATTING_HEADER_LABEL_CLASS =
  'font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant';

interface BatterTableCells {
  name: React.ReactNode;
  runs: React.ReactNode;
  fours: React.ReactNode;
  sixes: React.ReactNode;
  sr: React.ReactNode;
}

/** Shared column grid for batting header + data rows (same widths/alignment). */
function BatterTableRow({
  cells,
  rowClassName = '',
  rowStyle,
}: {
  cells: BatterTableCells;
  rowClassName?: string;
  rowStyle?: { minHeight?: number; height?: number };
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center pl-2 pr-0.5 ${rowClassName}`}
      style={rowStyle}
    >
      <View className="min-w-0 flex-1">{cells.name}</View>
      <View style={{ width: LIVE_BATTING_RUNS_COL_WIDTH }} className="shrink-0 items-end">
        {cells.runs}
      </View>
      <View style={{ width: LIVE_BATTING_BOUNDARY_COL_WIDTH }} className="shrink-0 items-end">
        {cells.fours}
      </View>
      <View style={{ width: LIVE_BATTING_BOUNDARY_COL_WIDTH }} className="shrink-0 items-end">
        {cells.sixes}
      </View>
      <View style={{ width: LIVE_BATTING_SR_COL_WIDTH }} className="shrink-0 items-end">
        {cells.sr}
      </View>
    </View>
  );
}

function LiveBattingHeaderRow(): React.ReactElement {
  return (
    <BatterTableRow
      rowClassName="border-b border-outline-variant/30"
      rowStyle={{ height: LIVE_BOWLING_HEADER_HEIGHT }}
      cells={{
        name: <Text className={BATTING_HEADER_LABEL_CLASS}>Batsman</Text>,
        runs: <Text className={`text-right ${BATTING_HEADER_LABEL_CLASS}`}>R (B)</Text>,
        fours: <Text className={`text-right ${BATTING_HEADER_LABEL_CLASS}`}>4s</Text>,
        sixes: <Text className={`text-right ${BATTING_HEADER_LABEL_CLASS}`}>6s</Text>,
        sr: <Text className={`text-right ${BATTING_HEADER_LABEL_CLASS}`}>SR</Text>,
      }}
    />
  );
}

export interface LiveScoringPlayerCardsProps {
  /** Fixed top-row batsman slot (does not swap on strike rotation). */
  batsman1Id: string | null;
  /** Fixed bottom-row batsman slot (does not swap on strike rotation). */
  batsman2Id: string | null;
  /** Engine-derived on-strike player — styling only, not row order. */
  onStrikePlayerId: string | null;
  bowlerId: string | null;
  batsman1Card: BatterCard | undefined;
  batsman2Card: BatterCard | undefined;
  bowlerCard: BowlerCard | undefined;
  /** All bowlers who have bowled this innings — drives the Bowling card table. */
  inningsBowlers?: BowlerCard[];
  needsIncomingBatter?: boolean;
  needsBowlerPick?: boolean;
  extras?: ExtrasBreakdown | null;
  compact?: boolean;
  nameOf: (id: string | null | undefined) => string;
  /** Bat icon — incoming batter when required, else striker slot. */
  onOpenBatsmanPicker: () => void;
  /** Placeholder row for fixed batsman 1 (striker) slot. */
  onPickBatsman1: () => void;
  /** Placeholder row for fixed batsman 2 (non-striker) slot. */
  onPickBatsman2: () => void;
  onPickBowler: () => void;
}

function SlimSelectorRow({
  placeholder,
  name,
  subline,
  onPress,
}: {
  placeholder: string;
  name: string | null;
  subline: string | null;
  onPress?: () => void;
}): React.ReactElement {
  const selected = Boolean(name);
  const row = (
    <View className="flex-row items-center gap-2 rounded-control border border-dashed border-outline-variant bg-surface px-3 py-2">
      <Ionicons
        name={selected ? 'person' : 'person-add-outline'}
        size={18}
        color={selected ? FIELD_ORANGE : colors.textMuted}
      />
      <View className="min-w-0 flex-1">
        <Text
          className={`font-sans-semibold text-sm ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}
          numberOfLines={1}
        >
          {selected ? name : placeholder}
        </Text>
        {selected && subline ? (
          <Text className="font-sans text-xs text-on-surface-variant" numberOfLines={1}>
            {subline}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </View>
  );

  if (!selected && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        className="active:opacity-80"
      >
        {row}
      </Pressable>
    );
  }

  return row;
}

function PopulatedBatterRow({
  name,
  card,
  onStrike,
}: {
  name: string;
  card: BatterCard | undefined;
  onStrike: boolean;
}): React.ReactElement {
  const runs = card?.runs ?? 0;
  const balls = card?.balls ?? 0;
  const fours = card?.fours ?? 0;
  const sixes = card?.sixes ?? 0;
  const strikeRate = formatBatterStrikeRateDisplay(card);

  return (
    <BatterTableRow
      rowClassName={[
        'rounded-control py-1.5',
        onStrike ? 'bg-primary-container/50' : 'bg-transparent',
      ].join(' ')}
      cells={{
        name: (
          <Text
            className={`font-sans-semibold text-base ${
              onStrike ? 'text-primary' : 'text-on-surface'
            }`}
            numberOfLines={1}
          >
            {name}
            {onStrike ? '*' : ''}
          </Text>
        ),
        runs: (
          <Text
            className="text-right font-sans-bold text-base text-on-surface"
            numberOfLines={1}
          >
            {runs}
            <Text className="font-sans text-sm text-on-surface-variant"> ({balls})</Text>
          </Text>
        ),
        fours: (
          <Text className="text-right font-sans text-sm text-on-surface" numberOfLines={1}>
            {fours}
          </Text>
        ),
        sixes: (
          <Text className="text-right font-sans text-sm text-on-surface" numberOfLines={1}>
            {sixes}
          </Text>
        ),
        sr: (
          <Text className="text-right font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {strikeRate}
          </Text>
        ),
      }}
    />
  );
}

function formatExtrasBreakdown(extras: ExtrasBreakdown): string | null {
  const parts: string[] = [];
  if (extras.wides > 0) parts.push(`wd ${extras.wides}`);
  if (extras.noBalls > 0) parts.push(`nb ${extras.noBalls}`);
  if (extras.byes > 0) parts.push(`b ${extras.byes}`);
  if (extras.legByes > 0) parts.push(`lb ${extras.legByes}`);
  if (extras.penalties !== 0) parts.push(`pen ${extras.penalties}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

function ExtrasRow({ extras }: { extras: ExtrasBreakdown }): React.ReactElement {
  const breakdown = formatExtrasBreakdown(extras);
  return (
    <View className="mt-0.5 flex-row items-center justify-between border-t border-outline-variant/40 pt-1.5 pl-2">
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-sm text-on-surface-variant">Extra Runs</Text>
        {breakdown ? (
          <Text className="font-sans text-xs text-on-surface-variant" numberOfLines={1}>
            ({breakdown})
          </Text>
        ) : null}
      </View>
      <Text className="font-sans-bold text-lg text-on-surface">{extras.total}</Text>
    </View>
  );
}

function CardShell({
  title,
  highlighted,
  hint,
  icon,
  children,
}: {
  title: string;
  highlighted: boolean;
  hint?: string | null;
  icon: React.ReactElement;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      className={[
        'gap-1.5 rounded-control border bg-surface px-3 py-2',
        highlighted ? 'border-2 border-primary bg-primary-container/30' : 'border-outline-variant',
      ].join(' ')}
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-sm uppercase tracking-wide text-on-surface-variant">
          {title}
        </Text>
        {icon}
      </View>
      {hint ? (
        <Text className="font-sans-semibold text-[11px] text-primary" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Batting and bowling selection cards — populated crease rows or dashed selectors. */
export function LiveScoringPlayerCards({
  batsman1Id,
  batsman2Id,
  onStrikePlayerId,
  bowlerId,
  batsman1Card,
  batsman2Card,
  bowlerCard,
  inningsBowlers = [],
  needsIncomingBatter = false,
  needsBowlerPick = false,
  extras = null,
  compact = false,
  nameOf,
  onOpenBatsmanPicker,
  onPickBatsman1,
  onPickBatsman2,
  onPickBowler,
}: LiveScoringPlayerCardsProps): React.ReactElement {
  const battersReady = Boolean(batsman1Id && batsman2Id);
  const showCompactBowling = compact && Boolean(bowlerId) && !needsBowlerPick;
  const usePopulatedBattingRows = compact && Boolean(batsman1Id || batsman2Id);

  const bowlerPlaceholder = needsBowlerPick ? 'Select bowler for this over' : 'Select Bowler';
  const batsman1Placeholder =
    needsIncomingBatter && !batsman1Id ? 'Select incoming batter' : 'Select Batsman 1';
  const batsman2Placeholder =
    needsIncomingBatter && !batsman2Id ? 'Select incoming batter' : 'Select Batsman 2';

  const currentBowlerCard =
    (bowlerId ? inningsBowlers.find((bowler) => bowler.playerId === bowlerId) : undefined) ??
    bowlerCard;

  /** Live-scoring card shows the active over bowler only — full list lives on the scorecard. */
  const bowlerRows: BowlerFiguresRow[] =
    bowlerId
      ? [
          {
            id: bowlerId,
            name: nameOf(bowlerId),
            card: currentBowlerCard,
            highlightName: true,
            nameSuffix: '*',
          },
        ]
      : [];

  const batIcon = (
    <Pressable
      onPress={onOpenBatsmanPicker}
      hitSlop={8}
      className="rounded-full p-1.5 active:bg-primary-container/40"
      accessibilityRole="button"
      accessibilityLabel="Select batsman"
    >
      <MaterialIcons name="sports-cricket" size={20} color={FIELD_ORANGE} />
    </Pressable>
  );

  const ballIcon = (
    <Pressable
      onPress={onPickBowler}
      hitSlop={8}
      className="rounded-full p-1.5 active:bg-primary-container/40"
      accessibilityRole="button"
      accessibilityLabel="Select bowler"
    >
      <BallTypeIcon ballType={BallType.Leather} size={20} accessibilityLabel="" />
    </Pressable>
  );

  function renderBatterSlot(
    playerId: string | null,
    card: BatterCard | undefined,
    placeholder: string,
    onPick: () => void,
  ): React.ReactElement {
    if (usePopulatedBattingRows && playerId) {
      return (
        <PopulatedBatterRow
          name={nameOf(playerId)}
          card={card}
          onStrike={playerId === onStrikePlayerId}
        />
      );
    }

    return (
      <SlimSelectorRow
        placeholder={placeholder}
        name={playerId ? nameOf(playerId) : null}
        subline={
          !compact && card
            ? `${card.runs} (${card.balls}) · 4s: ${card.fours} | 6s: ${card.sixes}`
            : null
        }
        onPress={!playerId ? onPick : undefined}
      />
    );
  }

  return (
    <View className={compact ? 'gap-2' : 'gap-4'}>
      <CardShell
        title="Batting"
        highlighted={needsIncomingBatter}
        hint={needsIncomingBatter ? 'Wicket — tap bat to pick incoming batter' : null}
        icon={batIcon}
      >
        <View className={usePopulatedBattingRows && battersReady ? 'gap-1' : 'gap-1.5'}>
          {usePopulatedBattingRows && (batsman1Id || batsman2Id) ? (
            <LiveBattingHeaderRow />
          ) : null}
          {renderBatterSlot(batsman1Id, batsman1Card, batsman1Placeholder, onPickBatsman1)}
          {renderBatterSlot(batsman2Id, batsman2Card, batsman2Placeholder, onPickBatsman2)}
          {usePopulatedBattingRows && battersReady && extras ? (
            <ExtrasRow extras={extras} />
          ) : null}
        </View>
      </CardShell>

      <CardShell
        title="Bowling"
        highlighted={needsBowlerPick}
        hint={needsBowlerPick ? 'Over complete — tap ball to pick next bowler' : null}
        icon={ballIcon}
      >
        {showCompactBowling && bowlerRows.length > 0 ? (
          <LiveScoringBowlerTable rows={bowlerRows} />
        ) : (
          <SlimSelectorRow
            placeholder={bowlerPlaceholder}
            name={bowlerId ? nameOf(bowlerId) : null}
            subline={null}
            onPress={!bowlerId ? onPickBowler : undefined}
          />
        )}
      </CardShell>
    </View>
  );
}
