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

import { SegmentedControl } from '../../ui/SegmentedControl';
import { Text } from '../../ui/Text';
import { FIELD_ORANGE } from '../../ui/fieldStyles';

type PeriodTab = 'tournaments' | 'year';

const PERIOD_TABS = [
  { value: 'tournaments' as const, label: 'By Tournaments' },
  { value: 'year' as const, label: 'By Year' },
];

const CARD_TITLE_TEXT = 'font-sans-bold text-base text-on-surface';
const CARD_SUBLINE_TEXT = 'font-sans text-sm text-on-surface-variant';
const CARD_INLINE_LABEL_TEXT = 'font-sans text-sm text-on-surface-variant';
const CARD_INLINE_VALUE_TEXT = 'font-sans-semibold text-sm text-on-surface';
const CARD_LINK_TEXT = 'font-sans-semibold text-sm text-primary';

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

function TournamentInlineStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View className="min-w-0 flex-1 flex-row items-baseline justify-center gap-0.5">
      <Text className={CARD_INLINE_LABEL_TEXT}>{label}</Text>
      <Text className={CARD_INLINE_VALUE_TEXT} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function TournamentSummaryCard({
  row,
  onViewDetails,
}: {
  row: PlayerProfileTournamentSummary;
  onViewDetails: () => void;
}): React.ReactElement {
  const { stats } = row;

  return (
    <View className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className={CARD_TITLE_TEXT}>{row.tournamentName}</Text>
          <Text className={`mt-1 ${CARD_SUBLINE_TEXT}`}>
            {row.year}
            {row.teamName ? ` • ${row.teamName}` : ''}
          </Text>
        </View>
        <Pressable onPress={onViewDetails} hitSlop={8} accessibilityRole="button">
          <Text className={CARD_LINK_TEXT}>View Details</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-0.5">
        <TournamentInlineStat
          label="Matches"
          value={formatPlayerProfileInteger(stats.matches)}
        />
        <Text className={CARD_SUBLINE_TEXT}>·</Text>
        <TournamentInlineStat label="Runs" value={formatPlayerProfileInteger(stats.runs)} />
        <Text className={CARD_SUBLINE_TEXT}>·</Text>
        <TournamentInlineStat
          label="Wickets"
          value={formatPlayerProfileInteger(stats.wickets)}
        />
      </View>
    </View>
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
      <View className="mb-4 items-center">
        <SegmentedControl
          options={PERIOD_TABS}
          value={tab}
          onChange={switchTab}
          accessibilityLabel="Stats period"
          size="md"
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
                <TournamentSummaryCard
                  key={row.tournamentId}
                  row={row}
                  onViewDetails={() => setSelectedTournamentId(row.tournamentId)}
                />
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
                <Text className={CARD_TITLE_TEXT}>{row.year}</Text>
                <Text className={`mt-1 ${CARD_SUBLINE_TEXT}`}>Click for details</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

export { FIELD_ORANGE };
