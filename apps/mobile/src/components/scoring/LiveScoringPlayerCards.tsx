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
import { BallTypeIcon } from '../ui/BallTypeIcon';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

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

  return (
    <View
      className={[
        'flex-row items-center justify-between rounded-control py-1.5 pl-2 pr-1',
        onStrike ? 'bg-primary-container/50' : 'bg-transparent',
      ].join(' ')}
    >
      <View className="min-w-0 flex-1">
        <Text
          className={`font-sans-semibold text-sm ${onStrike ? 'text-primary' : 'text-on-surface'}`}
          numberOfLines={1}
        >
          {name}
          {onStrike ? '*' : ''}
        </Text>
        <Text className="font-sans text-xs text-on-surface-variant">
          SR: {formatBatterStrikeRateDisplay(card)}
        </Text>
      </View>
      <View className="items-end pl-2">
        <Text className="font-sans-bold text-xl leading-6 text-on-surface">
          {runs}
          <Text className="font-sans text-sm text-on-surface-variant"> ({balls})</Text>
        </Text>
        <Text className="font-sans text-[10px] text-on-surface-variant">
          4s: {fours} | 6s: {sixes}
        </Text>
      </View>
    </View>
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
        <Text className="font-sans text-xs text-on-surface-variant">Extra Runs</Text>
        {breakdown ? (
          <Text className="font-sans text-[10px] text-on-surface-variant" numberOfLines={1}>
            ({breakdown})
          </Text>
        ) : null}
      </View>
      <Text className="font-sans-bold text-base text-on-surface">{extras.total}</Text>
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
        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-on-surface-variant">
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
        {showCompactBowling && bowlerId ? (
          <LiveScoringBowlerTable
            name={nameOf(bowlerId)}
            card={bowlerCard}
            isCurrent
          />
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
