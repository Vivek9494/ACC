import { type TournamentStatsView } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentStats } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const data = await getTournamentStats(tournamentId);
      setStats(data);
      setError(null);
    } catch (err) {
      setStats(null);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament stats.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (active && tournamentId) {
      void load();
    }
  }, [active, tournamentId, load]);

  if (loading && !stats) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-control bg-primary-50 px-4 py-3">
        <Text className="font-sans text-sm text-primary">{error}</Text>
      </View>
    );
  }

  const aggregates = stats?.aggregates ?? {
    totalRuns: 0,
    totalWickets: 0,
    sixes: 0,
    fours: 0,
    fifties: 0,
    hundreds: 0,
    fifers: 0,
  };

  return (
    <View className="gap-6">
      <TournamentStatsAggregateGrid aggregates={aggregates} />
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
    </View>
  );
}
