import type { LeaderboardTeamOption, TournamentLeaderboard } from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiRequestError, getTournamentLeaderboard } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { BattingLeaderboardList } from './BattingLeaderboardList';
import { BowlingLeaderboardList } from './BowlingLeaderboardList';

export type LeaderboardSubTab = 'bat' | 'bowl';

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
      <View className="flex-row border-b border-outline-variant">
        <LeaderboardSubTabButton
          label="Bat"
          active={subTab === 'bat'}
          onPress={() => setSubTab('bat')}
        />
        <LeaderboardSubTabButton
          label="Bowl"
          active={subTab === 'bowl'}
          onPress={() => setSubTab('bowl')}
        />
      </View>

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
        <View className="rounded-control bg-error-container px-4 py-3">
          <Text className="font-sans text-sm text-on-error-container">{error}</Text>
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

function LeaderboardSubTabButton({
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
      onPress={onPress}
      className={`flex-1 items-center py-3 ${active ? 'border-b-2 border-primary' : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          active ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
