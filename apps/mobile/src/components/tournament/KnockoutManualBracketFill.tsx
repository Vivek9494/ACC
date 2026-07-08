import {
  buildKnockoutManualBracketLayout,
  KnockoutManualSlotKind,
  type KnockoutManualMatch,
  type KnockoutManualSlot,
  type QualifiedTeam,
} from '@acc/types';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';

import { Text } from '../ui/Text';
import { TeamAvatar } from '../ui/TeamAvatar';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface KnockoutManualBracketFillProps {
  qualifiedTeams: QualifiedTeam[];
  /** seed (1-based) → placed teamId. */
  placementsBySeed: Map<number, string>;
  onPlace: (seed: number, teamId: string) => void;
  onClear: (seed: number) => void;
}

function ByeTag(): React.ReactElement {
  return (
    <View className="rounded-full bg-surface-container-high px-2 py-0.5">
      <Text className="font-sans-semibold text-[10px] text-on-surface-variant">BYE</Text>
    </View>
  );
}

function SeedBadge({ seed }: { seed: number }): React.ReactElement {
  return (
    <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
      <Text className="font-sans-semibold text-[11px] text-primary">{seed}</Text>
    </View>
  );
}

function ManualSlotRow({
  slot,
  teamName,
  onPress,
  onClear,
}: {
  slot: KnockoutManualSlot;
  teamName: string | null;
  onPress: () => void;
  onClear: () => void;
}): React.ReactElement {
  if (slot.kind === KnockoutManualSlotKind.WinnerOf) {
    return (
      <View className="min-h-[44px] flex-row items-center gap-2 px-1">
        <Text
          className="flex-1 font-sans text-sm italic text-on-surface-variant"
          numberOfLines={2}
        >
          {slot.feederLabel ?? 'Winner TBD'}
        </Text>
      </View>
    );
  }

  const seed = slot.seed ?? 0;

  if (teamName == null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pick team for seed ${seed}`}
        onPress={onPress}
        className="min-h-[44px] flex-row items-center gap-2 rounded-control border border-dashed border-primary/50 bg-primary/5 px-2 py-2 active:opacity-80"
      >
        <SeedBadge seed={seed} />
        <MaterialIcons name="add-circle-outline" size={18} color={FIELD_ORANGE} />
        <Text className="flex-1 font-sans-medium text-sm text-primary">Tap to pick</Text>
        {slot.isBye ? <ByeTag /> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change team for seed ${seed}`}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 rounded-control border border-outline-variant bg-surface px-2 py-2 active:opacity-80"
    >
      <SeedBadge seed={seed} />
      <TeamAvatar name={teamName} logoUrl={null} size="sm" />
      <Text
        className="min-w-0 flex-1 font-sans-semibold text-sm text-on-surface"
        numberOfLines={1}
      >
        {teamName}
      </Text>
      {slot.isBye ? <ByeTag /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Clear seed ${seed}`}
        hitSlop={8}
        onPress={onClear}
        className="p-1"
      >
        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
      </Pressable>
    </Pressable>
  );
}

function ManualMatchCard({
  match,
  highlighted,
  teamNameForSeed,
  onSlotPress,
  onSlotClear,
}: {
  match: KnockoutManualMatch;
  highlighted: boolean;
  teamNameForSeed: (seed: number) => string | null;
  onSlotPress: (slot: KnockoutManualSlot) => void;
  onSlotClear: (slot: KnockoutManualSlot) => void;
}): React.ReactElement {
  return (
    <View
      className={`gap-2 rounded-control border bg-surface p-3 ${
        highlighted ? 'border-primary' : 'border-outline-variant'
      }`}
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-semibold text-xs text-on-surface-variant">
        {match.roundLabel} · Match {match.bracketPosition + 1}
      </Text>
      <ManualSlotRow
        slot={match.homeSlot}
        teamName={match.homeSlot.seed != null ? teamNameForSeed(match.homeSlot.seed) : null}
        onPress={() => onSlotPress(match.homeSlot)}
        onClear={() => onSlotClear(match.homeSlot)}
      />
      <View className="h-px bg-outline-variant" />
      <ManualSlotRow
        slot={match.awaySlot}
        teamName={match.awaySlot.seed != null ? teamNameForSeed(match.awaySlot.seed) : null}
        onPress={() => onSlotPress(match.awaySlot)}
        onClear={() => onSlotClear(match.awaySlot)}
      />
    </View>
  );
}

function TeamPickerSheet({
  visible,
  teams,
  onSelect,
  onClose,
}: {
  visible: boolean;
  teams: QualifiedTeam[];
  onSelect: (teamId: string) => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <View
          className="max-h-[70%] rounded-t-xl bg-surface px-4 pb-8 pt-4"
          onStartShouldSetResponder={() => true}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-stone-200" />
          <Text className="mb-3 font-sans-bold text-base text-on-surface">Pick a team</Text>
          <FlatList
            data={teams}
            keyExtractor={(item) => item.teamId}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.teamName}
                onPress={() => onSelect(item.teamId)}
                className="flex-row items-center gap-3 rounded-control border border-outline-variant bg-surface px-3 py-3 active:opacity-80"
              >
                <TeamAvatar name={item.teamName} logoUrl={null} size="sm" />
                <Text
                  className="min-w-0 flex-1 font-sans-medium text-base text-on-surface"
                  numberOfLines={1}
                >
                  {item.teamName}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="items-center py-6">
                <Text className="text-center font-sans text-sm text-on-surface-variant">
                  All qualified teams are already placed.
                </Text>
              </View>
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * Tap-to-fill manual seeding: the CM places qualified teams into the bracket's
 * first-round (and bye) slots by tapping. The tree structure and later-round
 * "Winner of…" placeholders come from the shared Phase 2/3 layout, so the
 * arrangement drives generation identically to automatic mode.
 */
export function KnockoutManualBracketFill({
  qualifiedTeams,
  placementsBySeed,
  onPlace,
  onClear,
}: KnockoutManualBracketFillProps): React.ReactElement {
  const [pickerSeed, setPickerSeed] = useState<number | null>(null);

  const layout = useMemo(
    () => buildKnockoutManualBracketLayout(qualifiedTeams.length),
    [qualifiedTeams.length],
  );

  const teamsById = useMemo(
    () => new Map(qualifiedTeams.map((team) => [team.teamId, team])),
    [qualifiedTeams],
  );

  const filledCount = placementsBySeed.size;
  const totalCount = layout.fillableSlotCount;
  const remaining = totalCount - filledCount;

  const firstEmptyMatchKey = useMemo(() => {
    for (const round of layout.rounds) {
      for (const match of round.matches) {
        const homeEmpty =
          match.homeSlot.kind === KnockoutManualSlotKind.Seed &&
          match.homeSlot.seed != null &&
          !placementsBySeed.has(match.homeSlot.seed);
        const awayEmpty =
          match.awaySlot.kind === KnockoutManualSlotKind.Seed &&
          match.awaySlot.seed != null &&
          !placementsBySeed.has(match.awaySlot.seed);
        if (homeEmpty || awayEmpty) {
          return match.key;
        }
      }
    }
    return null;
  }, [layout, placementsBySeed]);

  function teamNameForSeed(seed: number): string | null {
    const teamId = placementsBySeed.get(seed);
    if (teamId == null) {
      return null;
    }
    return teamsById.get(teamId)?.teamName ?? null;
  }

  const availableTeams = useMemo(() => {
    if (pickerSeed == null) {
      return [];
    }
    const placedElsewhere = new Set<string>();
    for (const [seed, teamId] of placementsBySeed.entries()) {
      if (seed !== pickerSeed) {
        placedElsewhere.add(teamId);
      }
    }
    return qualifiedTeams.filter((team) => !placedElsewhere.has(team.teamId));
  }, [pickerSeed, placementsBySeed, qualifiedTeams]);

  function handleSlotPress(slot: KnockoutManualSlot): void {
    if (slot.kind !== KnockoutManualSlotKind.Seed || slot.seed == null) {
      return;
    }
    setPickerSeed(slot.seed);
  }

  function handleSlotClear(slot: KnockoutManualSlot): void {
    if (slot.seed == null) {
      return;
    }
    onClear(slot.seed);
  }

  function handleSelect(teamId: string): void {
    if (pickerSeed != null) {
      onPlace(pickerSeed, teamId);
    }
    setPickerSeed(null);
  }

  return (
    <View className="gap-4">
      <View className="gap-1 rounded-control bg-white p-4 shadow-sm">
        <Text className="font-sans-bold text-base text-on-surface">Place teams into the bracket</Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          Tap each slot to pick a qualified team. Winners of earlier matches fill the later rounds
          automatically.
        </Text>
        <View className="mt-2 flex-row items-center gap-2">
          <View
            className={`rounded-full px-3 py-1 ${
              remaining === 0 ? 'bg-green-100' : 'bg-primary/10'
            }`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                remaining === 0 ? 'text-green-700' : 'text-primary'
              }`}
            >
              {filledCount} of {totalCount} slots filled
            </Text>
          </View>
          {remaining > 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">
              {remaining} {remaining === 1 ? 'slot' : 'slots'} left
            </Text>
          ) : null}
        </View>
        {layout.byeCount > 0 ? (
          <Text className="mt-1 font-sans text-sm text-on-surface-variant">
            {layout.byeCount} {layout.byeCount === 1 ? 'team receives a bye' : 'teams receive byes'}{' '}
            (marked BYE) — placed directly into their {layout.rounds[1]?.roundLabel ?? 'later-round'}{' '}
            slots.
          </Text>
        ) : null}
      </View>

      {layout.rounds.map((round) => (
        <View key={round.bracketRoundIndex} className="gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="font-sans-bold text-base text-on-surface">{round.roundLabel}</Text>
            {!round.hasFillableSlot ? (
              <Text className="font-sans text-xs text-on-surface-variant">(auto-filled)</Text>
            ) : null}
          </View>
          {round.matches.map((match) => (
            <ManualMatchCard
              key={match.key}
              match={match}
              highlighted={match.key === firstEmptyMatchKey}
              teamNameForSeed={teamNameForSeed}
              onSlotPress={handleSlotPress}
              onSlotClear={handleSlotClear}
            />
          ))}
        </View>
      ))}

      <TeamPickerSheet
        visible={pickerSeed != null}
        teams={availableTeams}
        onSelect={handleSelect}
        onClose={() => setPickerSeed(null)}
      />
    </View>
  );
}
