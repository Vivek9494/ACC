import type {
  PlayerProfilePeriodStats,
  PlayerProfileTournamentSummary,
  PlayerProfileYearSummary,
} from '@acc/types';
import {
  formatPlayerProfileAverage,
  formatPlayerProfileInteger,
  formatPlayerProfileStrikeRate,
} from '@acc/types';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { FIELD_ORANGE } from '../../ui/fieldStyles';

type PeriodTab = 'tournaments' | 'year';

interface PeriodStatCellProps {
  label: string;
  value: string;
}

function PeriodStatCell({ label, value }: PeriodStatCellProps): React.ReactElement {
  return (
    <View className="w-[48%] rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
      <Text className="font-sans-semibold text-xs uppercase text-on-surface-variant">{label}</Text>
      <Text className="mt-1 font-sans-bold text-lg text-on-surface">{value}</Text>
    </View>
  );
}

function PeriodStatsGrid({ stats }: { stats: PlayerProfilePeriodStats }): React.ReactElement {
  return (
    <View className="flex-row flex-wrap gap-3">
      <PeriodStatCell label="Matches" value={formatPlayerProfileInteger(stats.matches)} />
      <PeriodStatCell label="Runs" value={formatPlayerProfileInteger(stats.runs)} />
      <PeriodStatCell label="Avg" value={formatPlayerProfileAverage(stats.average)} />
      <PeriodStatCell label="HS" value={stats.highestScore ?? '–'} />
      <PeriodStatCell label="SR" value={formatPlayerProfileStrikeRate(stats.strikeRate)} />
      <PeriodStatCell label="Wickets" value={formatPlayerProfileInteger(stats.wickets)} />
      <PeriodStatCell label="BBI" value={stats.bestBowling ?? '–'} />
      <PeriodStatCell label="Catches" value={formatPlayerProfileInteger(stats.catches)} />
      <PeriodStatCell label="Sixes" value={formatPlayerProfileInteger(stats.sixes)} />
      <PeriodStatCell label="Fours" value={formatPlayerProfileInteger(stats.fours)} />
    </View>
  );
}

function PeriodTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      className={`flex-1 border-b-2 py-3 ${active ? 'border-primary' : 'border-transparent'}`}
      onPress={onPress}
    >
      <Text
        className={`text-center font-sans-semibold text-sm ${
          active ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface PlayerProfilePeriodSectionProps {
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
}

/** By Tournaments / By Year toggle with list → drilldown stat grids. */
export function PlayerProfilePeriodSection({
  byYear,
  byTournament,
}: PlayerProfilePeriodSectionProps): React.ReactElement {
  const [tab, setTab] = useState<PeriodTab>('tournaments');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const selectedYearRow = selectedYear != null ? byYear.find((row) => row.year === selectedYear) : null;
  const selectedTournamentRow =
    selectedTournamentId != null
      ? byTournament.find((row) => row.tournamentId === selectedTournamentId)
      : null;

  function switchTab(next: PeriodTab): void {
    setTab(next);
    setSelectedYear(null);
    setSelectedTournamentId(null);
  }

  return (
    <View className="mb-8">
      <View className="mb-4 flex-row border-b border-outline-variant">
        <PeriodTabButton
          label="By Tournaments"
          active={tab === 'tournaments'}
          onPress={() => switchTab('tournaments')}
        />
        <PeriodTabButton
          label="By Year"
          active={tab === 'year'}
          onPress={() => switchTab('year')}
        />
      </View>

      {tab === 'tournaments' ? (
        selectedTournamentRow ? (
          <View>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-sans-bold text-lg text-on-surface">
                {selectedTournamentRow.tournamentName} Statistics
              </Text>
              <Pressable onPress={() => setSelectedTournamentId(null)}>
                <Text className="font-sans-semibold text-sm text-primary">Back</Text>
              </Pressable>
            </View>
            <PeriodStatsGrid stats={selectedTournamentRow.stats} />
          </View>
        ) : (
          <View className="gap-3">
            {byTournament.length === 0 ? (
              <Text className="font-sans text-sm text-on-surface-variant">
                No scored tournament appearances yet.
              </Text>
            ) : (
              byTournament.map((row) => (
                <Pressable
                  key={row.tournamentId}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 active:border-primary"
                  onPress={() => setSelectedTournamentId(row.tournamentId)}
                >
                  <Text className="font-sans-bold text-base text-on-surface">{row.tournamentName}</Text>
                  <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                    {row.year}
                    {row.teamName ? ` • ${row.teamName}` : ''}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )
      ) : selectedYearRow ? (
        <View>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-sans-bold text-lg text-on-surface">
              Year {selectedYearRow.year} Statistics
            </Text>
            <Pressable onPress={() => setSelectedYear(null)}>
              <Text className="font-sans-semibold text-sm text-primary">Back</Text>
            </Pressable>
          </View>
          <PeriodStatsGrid stats={selectedYearRow.stats} />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {byYear.length === 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">
              No scored appearances yet.
            </Text>
          ) : (
            byYear.map((row) => (
              <Pressable
                key={row.year}
                className="w-[48%] rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 active:border-primary"
                onPress={() => setSelectedYear(row.year)}
              >
                <Text className="font-sans-bold text-base text-on-surface">{row.year}</Text>
                <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                  Click for details
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

export { FIELD_ORANGE };
