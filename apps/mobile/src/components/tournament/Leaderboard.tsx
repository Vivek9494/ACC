import type { LeaderboardTeamOption, TournamentLeaderboard } from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentLeaderboard } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { PillTabBar } from '../ui/PillTabBar';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { BattingLeaderboardList } from './BattingLeaderboardList';
import { BowlingLeaderboardList } from './BowlingLeaderboardList';

export type LeaderboardSubTab = 'bat' | 'bowl';

const LEADERBOARD_SUB_TABS = [
  { value: 'bat' as const, label: 'Bat' },
  { value: 'bowl' as const, label: 'Bowl' },
];

export interface LeaderboardProps {
  tournamentId: string;
  initialData: TournamentLeaderboard;
}

/** Populated tournament leaderboard — Bat/Bowl sub-tabs with team filter (§15.5). */
export function Leaderboard({ tournamentId, initialData }: LeaderboardProps): React.ReactElement {
  const [subTab, setSubTab] = useState<LeaderboardSubTab>('bat');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [data, setData] = useState<TournamentLeaderboard>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamOptions = useMemo(
    () => [
      { value: 'all', label: 'All teams' },
      ...data.teams.map((team: LeaderboardTeamOption) => ({
        value: team.id,
        label: team.name,
      })),
    ],
    [data.teams],
  );

  const load = useCallback(
    async (nextTeamId: string | null) => {
      setLoading(true);
      setError(null);
      try {
        setData(await getTournamentLeaderboard(tournamentId, nextTeamId));
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load leaderboard.');
      } finally {
        setLoading(false);
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  function handleTeamFilterChange(value: string): void {
    const nextTeamId = value === 'all' ? null : value;
    setTeamFilter(nextTeamId);
    void load(nextTeamId);
  }

  const activeEntries =
    subTab === 'bat' ? data.batting.entries : data.bowling.entries;
  const emptyMessage =
    subTab === 'bat'
      ? 'No batting records for this team yet.'
      : 'No bowling records for this team yet.';

  return (
    <View className="gap-4">
      <PillTabBar
        accessibilityLabel="Leaderboard category"
        options={LEADERBOARD_SUB_TABS}
        value={subTab}
        onChange={setSubTab}
      />

      <Select
        label="Filter by Team"
        labelVariant="brand"
        placeholder="All teams"
        value={teamFilter ?? 'all'}
        options={teamOptions}
        onChange={handleTeamFilterChange}
      />

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {error ? (
        <View className="rounded-control bg-primary-50 px-4 py-3">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        activeEntries.length > 0 ? (
          subTab === 'bat' ? (
            <BattingLeaderboardList entries={data.batting.entries} />
          ) : (
            <BowlingLeaderboardList entries={data.bowling.entries} />
          )
        ) : (
          <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
            {emptyMessage}
          </Text>
        )
      ) : null}
    </View>
  );
}
