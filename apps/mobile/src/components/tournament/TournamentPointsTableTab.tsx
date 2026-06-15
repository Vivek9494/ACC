import {
  MatchSchedulingFormat,
  shouldSplitStandingsByGroup,
  type TournamentStandings,
} from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentStandings } from '../../lib/api';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { StandingsCombinedTable } from './StandingsCombinedTable';
import { StandingsGroupTable } from './StandingsGroupTable';

export interface TournamentPointsTableTabProps {
  tournamentId: string;
  active: boolean;
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount: number;
}

/** Points Table tab — per-group or combined standings from completed matches. */
export function TournamentPointsTableTab({
  tournamentId,
  active,
  matchSchedulingFormat,
  groupCount,
}: TournamentPointsTableTabProps): React.ReactElement {
  const [standings, setStandings] = useState<TournamentStandings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitByGroup = shouldSplitStandingsByGroup(matchSchedulingFormat, groupCount);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const data = await getTournamentStandings(tournamentId);
      setStandings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load points table.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (active && tournamentId) {
      void load();
    }
  }, [active, tournamentId, load]);

  if (loading && !standings) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-control bg-error-container px-4 py-3">
        <Text className="font-sans text-sm text-on-error-container">{error}</Text>
      </View>
    );
  }

  const tables = standings?.tables ?? [];
  const dataErrors = standings?.dataErrors ?? [];

  if (tables.length === 0) {
    const message =
      splitByGroup && groupCount === 0
        ? 'Create groups to see the points table.'
        : 'No teams in this tournament yet.';
    return (
      <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">{message}</Text>
    );
  }

  return (
    <View className="gap-4">
      {dataErrors.length > 0 ? (
        <View className="rounded-control bg-error-container px-4 py-3">
          <Text className="font-sans text-sm text-on-error-container">
            {dataErrors.length} match{dataErrors.length === 1 ? '' : 'es'} could not be scored
            (missing Super Over winner). Points for those matches are excluded until corrected.
          </Text>
        </View>
      ) : null}
      {splitByGroup
        ? tables.map((section) => (
            <StandingsGroupTable
              key={section.groupId ?? section.groupName}
              section={section}
              showGroupHeader
            />
          ))
        : tables.map((section) => (
            <StandingsCombinedTable key={section.groupId ?? 'combined'} section={section} />
          ))}
    </View>
  );
}
