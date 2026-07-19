import {
  MatchSchedulingFormat,
  mergeStandingsTablesForListView,
  shouldShowStandingsListViewToggle,
  shouldSplitStandingsByGroup,
  type TournamentStandings,
} from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, getTournamentStandings } from '../../lib/api';
import { Button } from '../ui/Button';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { StandingsCombinedTable } from './StandingsCombinedTable';
import { StandingsGroupTable } from './StandingsGroupTable';

export type PointsTableViewMode = 'grouped' | 'list';

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
  const [viewMode, setViewMode] = useState<PointsTableViewMode>('grouped');

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

  useEffect(() => {
    setViewMode('grouped');
  }, [tournamentId]);

  const tables = standings?.tables ?? [];
  const dataErrors = standings?.dataErrors ?? [];
  const showNetRunRate = standings?.showNetRunRate ?? true;
  const showListViewToggle = shouldShowStandingsListViewToggle(
    matchSchedulingFormat,
    groupCount,
    tables.length,
  );

  const mergedListView = useMemo(() => {
    if (!showListViewToggle) {
      return null;
    }
    return mergeStandingsTablesForListView(tables);
  }, [showListViewToggle, tables]);

  if (loading && !standings) {
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

  if (tables.length === 0) {
    const message =
      splitByGroup && groupCount === 0
        ? 'Create groups to see the points table.'
        : 'No teams in this tournament yet.';
    return (
      <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">{message}</Text>
    );
  }

  const showGroupedView = !showListViewToggle || viewMode === 'grouped';

  return (
    <View className="gap-4">
      {showListViewToggle ? (
        <View className="flex-row justify-end">
          <Button
            variant="outline"
            className="h-10 px-4"
            label={showGroupedView ? 'List View' : 'Grouped View'}
            onPress={() => setViewMode(showGroupedView ? 'list' : 'grouped')}
          />
        </View>
      ) : null}

      {dataErrors.length > 0 ? (
        <View className="rounded-control bg-primary-50 px-4 py-3">
          <Text className="font-sans text-sm text-primary">
            {dataErrors.length} match{dataErrors.length === 1 ? '' : 'es'} could not be scored
            {dataErrors.some((error) => /super over/i.test(error.message))
              ? ' (missing Super Over winner)'
              : ''}
            . Points for those matches are excluded until corrected.
          </Text>
        </View>
      ) : null}

      {showGroupedView
        ? tables.map((section) => (
            <StandingsGroupTable
              key={section.groupId ?? section.groupName}
              section={section}
              showGroupHeader
              showNetRunRate={showNetRunRate}
            />
          ))
        : mergedListView ? (
            <StandingsCombinedTable
              section={{
                groupId: null,
                groupName: 'All teams',
                teams: mergedListView.teams,
              }}
              groupLabelByTeamId={mergedListView.groupLabelByTeamId}
              showNetRunRate={showNetRunRate}
            />
          ) : null}
    </View>
  );
}
