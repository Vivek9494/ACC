import { tournamentLeaderboardHasRecords, type TournamentLeaderboard } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentLeaderboard } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { Leaderboard } from './Leaderboard';
import { TournamentLeaderboardEmptyState } from './TournamentLeaderboardEmptyState';

export interface TournamentLeaderboardTabProps {
  tournamentId: string;
  active: boolean;
}

/** Leaderboard tab — empty until scoring produces player stats (§15.5). */
export function TournamentLeaderboardTab({
  tournamentId,
  active,
}: TournamentLeaderboardTabProps): React.ReactElement {
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const data = await getTournamentLeaderboard(tournamentId);
      setLeaderboard(data);
      setError(null);
    } catch (err) {
      setLeaderboard(null);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (active && tournamentId) {
      void load();
    }
  }, [active, tournamentId, load]);

  if (loading && !leaderboard) {
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

  if (!tournamentLeaderboardHasRecords(leaderboard)) {
    return <TournamentLeaderboardEmptyState />;
  }

  return <Leaderboard tournamentId={tournamentId} initialData={leaderboard!} />;
}
