import {
  tournamentStatsHasRecords,
  type LeaderboardTeamOption,
  type TournamentStatsView,
} from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentStats } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { TournamentBoundaryLeaderboardSection } from './TournamentBoundaryLeaderboardSection';
import { TournamentStatsAggregateGrid } from './TournamentStatsAggregateGrid';

export interface TournamentStatsTabProps {
  tournamentId: string;
  active: boolean;
}

/** Tournament Stats tab — aggregate totals + Most Sixes / Most Fours (incl. live). */
export function TournamentStatsTab({
  tournamentId,
  active,
}: TournamentStatsTabProps): React.ReactElement {
  const [stats, setStats] = useState<TournamentStatsView | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextTeamId: string | null) => {
      if (!tournamentId) {
        return;
      }
      setLoading(true);
      try {
        const data = await getTournamentStats(tournamentId, nextTeamId);
        setStats(data);
        setError(null);
      } catch (err) {
        setStats(null);
        setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament stats.');
      } finally {
        setLoading(false);
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    if (active && tournamentId) {
      setTeamFilter(null);
      void load(null);
    }
  }, [active, tournamentId, load]);

  const teamOptions = useMemo(
    () => [
      { value: 'all', label: 'All Teams' },
      ...(stats?.teams ?? []).map((team: LeaderboardTeamOption) => ({
        value: team.id,
        label: team.name,
      })),
    ],
    [stats?.teams],
  );

  function handleTeamFilterChange(value: string): void {
    const nextTeamId = value === 'all' ? null : value;
    setTeamFilter(nextTeamId);
    void load(nextTeamId);
  }

  if (loading && !stats) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View className="rounded-control bg-primary-50 px-4 py-3">
        <Text className="font-sans text-sm text-primary">{error}</Text>
      </View>
    );
  }

  const showTeamEmpty = teamFilter != null && !tournamentStatsHasRecords(stats);

  return (
    <View className="gap-6">
      {teamOptions.length > 1 ? (
        <Select
          label="Team"
          labelVariant="brand"
          placeholder="All Teams"
          value={teamFilter ?? 'all'}
          options={teamOptions}
          onChange={handleTeamFilterChange}
        />
      ) : null}

      {loading ? (
        <View className="items-center py-4">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {error ? (
        <View className="rounded-control bg-primary-50 px-4 py-3">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && !error && showTeamEmpty ? (
        <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
          No stats yet for this team
        </Text>
      ) : null}

      {!loading && !error && !showTeamEmpty ? (
        <>
          <TournamentStatsAggregateGrid
            aggregates={
              stats?.aggregates ?? {
                totalRuns: 0,
                totalWickets: 0,
                sixes: 0,
                fours: 0,
                fifties: 0,
                hundreds: 0,
                fifers: 0,
              }
            }
          />
          <TournamentBoundaryLeaderboardSection
            title="Most Sixes"
            unitLabel="6s"
            entries={stats?.mostSixes ?? []}
          />
          <TournamentBoundaryLeaderboardSection
            title="Most Fours"
            unitLabel="4s"
            entries={stats?.mostFours ?? []}
          />
        </>
      ) : null}
    </View>
  );
}
