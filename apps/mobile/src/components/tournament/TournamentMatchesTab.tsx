import {
  BallType,
  MatchSchedulingFormat,
  MATCH_LIST_GROUP_FILTER,
  canViewAdminUsersDirectory,
  canViewCancelledMatchDetails,
  filterMatchList,
  tournamentSupportsGroups,
  type GroupSummary,
  type MatchListItem,
  type MatchSchedulingFormat as MatchSchedulingFormatType,
  type RegistrationStatus,
  type TournamentDetail,
  type TournamentType,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, listMatches, selectMatchSchedulingFormat } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { buildMatchMenuActions } from '../../lib/build-match-menu-actions';
import { subscribeMatchDataInvalidation } from '../../lib/match-data-invalidation';
import { canCreateTournamentTeam } from '../../lib/can-create-team';
import {
  canManageUpcomingMatchSchedule,
  canScheduleTournamentMatchesAsOrganizer,
} from '../../lib/can-schedule-matches';
import {
  shouldShowKnockoutBracketEntry,
  shouldShowKnockoutChartEntry,
} from './KnockoutBracketManageScreen';
import { tournamentSubpathHref } from '../../lib/tournament-detail-route';
import { GroupSetupRequiredDialog } from '../ui/GroupSetupRequiredDialog';
import { ScheduleMatchesNoTeamsDialog } from '../ui/ScheduleMatchesNoTeamsDialog';
import { SelectFormatModal } from '../ui/SelectFormatModal';
import { Button } from '../ui/Button';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { MatchList } from './MatchList';
import { TournamentMatchesEmptyState } from './TournamentMatchesEmptyState';

export interface TournamentMatchesTabProps {
  tournamentId: string;
  active: boolean;
  teamCount: number;
  ballType: TournamentDetail['ballType'];
  teams?: TournamentDetail['teams'];
  groups?: GroupSummary[];
  tournamentType?: TournamentType;
  /** Server-resolved CREATE_MATCH gate for this tournament (includes Leather captains). */
  canScheduleMatches?: boolean;
  matchSchedulingFormat?: TournamentDetail['matchSchedulingFormat'];
  hasKnockoutBracket?: boolean;
  tournamentName?: string;
  /** Viewer's registration in this tournament (`GET .../registrations/me`). */
  viewerRegistrationStatus?: RegistrationStatus | null;
}

export function TournamentMatchesTab({
  tournamentId,
  active,
  teamCount,
  ballType,
  teams = [],
  groups = [],
  tournamentType,
  canScheduleMatches = false,
  matchSchedulingFormat = null,
  hasKnockoutBracket = false,
  tournamentName = '',
  viewerRegistrationStatus = null,
}: TournamentMatchesTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noTeamsDialogVisible, setNoTeamsDialogVisible] = useState(false);
  const [selectFormatVisible, setSelectFormatVisible] = useState(false);
  const [setupRequiredVisible, setSetupRequiredVisible] = useState(false);
  const [selectingFormat, setSelectingFormat] = useState(false);
  const [selectFormatError, setSelectFormatError] = useState<string | null>(null);

  const isLeatherBall = ballType === BallType.Leather;
  const showTeamFilter = isLeatherBall && teams.length > 0;
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const showGroupFilter =
    tournamentType != null &&
    tournamentSupportsGroups({
      type: tournamentType,
      matchSchedulingFormat,
      groupCount: groups.length,
    });
  const [groupFilter, setGroupFilter] = useState<string>(MATCH_LIST_GROUP_FILTER.All);

  const teamFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Teams' },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
    [teams],
  );

  const groupFilterOptions = useMemo(
    () => [
      { value: MATCH_LIST_GROUP_FILTER.All, label: 'All groups' },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
      { value: MATCH_LIST_GROUP_FILTER.Knockout, label: 'Knockout' },
    ],
    [groups],
  );

  const filteredMatches = useMemo(
    () =>
      filterMatchList(matches, {
        teamId: teamFilter,
        groupFilter,
      }),
    [matches, teamFilter, groupFilter],
  );

  const hasMatches = matches.length > 0;
  const hasFilteredMatches = filteredMatches.length > 0;

  const emptyFilterMessage = useMemo((): string | null => {
    if (hasFilteredMatches || !hasMatches) {
      return null;
    }
    if (groupFilter !== MATCH_LIST_GROUP_FILTER.All) {
      if (groupFilter === MATCH_LIST_GROUP_FILTER.Knockout) {
        return 'No knockout matches yet.';
      }
      return 'No matches for this group.';
    }
    if (teamFilter) {
      return 'No matches for this team yet.';
    }
    return null;
  }, [groupFilter, hasFilteredMatches, hasMatches, teamFilter]);

  const canSchedule = canScheduleMatches;
  const canManageGroups = canScheduleTournamentMatchesAsOrganizer(user);
  const canCreateTeam = canCreateTournamentTeam(user);
  const canManageMatches = canManageUpcomingMatchSchedule(user);
  const showLiveMatchDetails = user != null && canViewAdminUsersDirectory(user.role);
  const showCancelledMatchDetails =
    user != null &&
    canViewCancelledMatchDetails({
      role: user.role,
      registrationStatus: viewerRegistrationStatus,
    });
  const showKnockoutChartEntry = shouldShowKnockoutChartEntry(
    { matchSchedulingFormat, hasKnockoutBracket },
    user,
  );
  const showKnockoutBracketEntry = shouldShowKnockoutBracketEntry(
    { matchSchedulingFormat },
    user,
  );
  const knockoutManageButtonLabel = hasKnockoutBracket
    ? 'Manage Knockout Bracket'
    : 'Generate Knockout Bracket';

  function handleKnockoutChartPress(): void {
    router.push(
      tournamentSubpathHref(user, tournamentId, 'knockout-chart', {
        name: tournamentName,
      }),
    );
  }

  function handleKnockoutBracketPress(): void {
    router.push(
      tournamentSubpathHref(user, tournamentId, 'knockout-bracket', {
        name: tournamentName,
      }),
    );
  }

  function renderKnockoutAndScheduleActions(): React.ReactNode {
    if (!showKnockoutChartEntry && !showKnockoutBracketEntry && !canSchedule) {
      return null;
    }
    return (
      <View className="gap-3">
        {showKnockoutChartEntry ? (
          <Button
            label="Knockout Chart"
            variant="outline"
            onPress={handleKnockoutChartPress}
            className="h-12 w-full"
          />
        ) : null}

        {showKnockoutBracketEntry ? (
          <Button
            label={knockoutManageButtonLabel}
            variant="secondary"
            onPress={handleKnockoutBracketPress}
            className="h-12 w-full"
          />
        ) : null}

        {canSchedule ? (
          <Button
            label="Schedule Matches"
            variant="amber"
            onPress={handleSchedulePress}
            className="h-12 w-full"
          />
        ) : null}
      </View>
    );
  }

  const loadMatches = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      setMatches(await listMatches(tournamentId));
    } catch (err) {
      setMatches([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load matches.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [tournamentId]);

  const buildMenuActions = useCallback(
    (match: MatchListItem) =>
      buildMatchMenuActions(match, tournamentId, matchSchedulingFormat, router, {
        canManage: canManageMatches,
        onDeleted: () => void loadMatches(),
        user,
      }),
    [canManageMatches, loadMatches, matchSchedulingFormat, router, tournamentId, user],
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadMatches();
  }, [active, loadMatches]);

  useFocusEffect(
    useCallback(() => {
      if (!active) {
        return;
      }
      void loadMatches({ silent: loaded });
    }, [active, loadMatches, loaded]),
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    return subscribeMatchDataInvalidation(() => {
      void loadMatches({ silent: true });
    });
  }, [active, loadMatches]);

  function handleSchedulePress(): void {
    if (!canSchedule) {
      return;
    }
    if (teamCount < 2) {
      setNoTeamsDialogVisible(true);
      return;
    }
    setSelectFormatError(null);
    setSelectFormatVisible(true);
  }

  function handleCreateTeam(): void {
    setNoTeamsDialogVisible(false);
    router.push(tournamentSubpathHref(user, tournamentId, 'add-team'));
  }

  function handleCreateGroup(): void {
    setSetupRequiredVisible(false);
    router.push(tournamentSubpathHref(user, tournamentId, 'create-group'));
  }

  function navigateToSchedulingFlow(format: MatchSchedulingFormatType): void {
    router.push(
      tournamentSubpathHref(user, tournamentId, 'match-setup', {
        format,
      }),
    );
  }

  async function handleFormatSelect(format: MatchSchedulingFormatType): Promise<void> {
    setSelectingFormat(true);
    setSelectFormatError(null);
    try {
      const updated = await selectMatchSchedulingFormat(tournamentId, format);
      setSelectFormatVisible(false);

      if (
        format === MatchSchedulingFormat.GroupStageKnockout &&
        updated.groupCount === 0
      ) {
        setSetupRequiredVisible(true);
        return;
      }

      navigateToSchedulingFlow(format);
    } catch (err) {
      setSelectFormatError(
        err instanceof ApiRequestError ? err.message : 'Could not save scheduling format.',
      );
    } finally {
      setSelectingFormat(false);
    }
  }

  function handleTeamFilterChange(value: string): void {
    setTeamFilter(value === 'all' ? null : value);
  }

  function handleGroupFilterChange(value: string): void {
    setGroupFilter(value);
  }

  if (loading && !loaded) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center px-6 py-12">
        <Text className="text-center font-sans text-base text-on-surface-variant">{error}</Text>
      </View>
    );
  }

  return (
    <>
      {hasMatches ? (
        <View className="gap-4">
          {renderKnockoutAndScheduleActions()}

          {showTeamFilter ? (
            <Select
              label="Teams"
              labelVariant="brand"
              placeholder="All Teams"
              value={teamFilter ?? 'all'}
              options={teamFilterOptions}
              onChange={handleTeamFilterChange}
            />
          ) : null}

          {showGroupFilter ? (
            <Select
              label="Group"
              labelVariant="brand"
              placeholder="All groups"
              value={groupFilter}
              options={groupFilterOptions}
              onChange={handleGroupFilterChange}
            />
          ) : null}

          {hasFilteredMatches ? (
            <MatchList
              matches={filteredMatches}
              onMatchPress={(matchId) => router.push(`/matches/${matchId}`)}
              onWatchLivePress={(matchId) => router.push(`/matches/${matchId}/live`)}
              onScorecardPress={(matchId) => router.push(`/matches/${matchId}/scorecard`)}
              buildMenuActions={buildMenuActions}
              showLiveMatchDetails={showLiveMatchDetails}
              showCancelledMatchDetails={showCancelledMatchDetails}
            />
          ) : emptyFilterMessage ? (
            <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
              {emptyFilterMessage}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="gap-4">
          {renderKnockoutAndScheduleActions()}
          <TournamentMatchesEmptyState
            canSchedule={false}
            message={
              showKnockoutChartEntry || showKnockoutBracketEntry || canSchedule
                ? null
                : 'No matches scheduled yet.'
            }
          />
        </View>
      )}

      <ScheduleMatchesNoTeamsDialog
        visible={noTeamsDialogVisible}
        teamCount={teamCount}
        canCreateTeam={canCreateTeam}
        onCancel={() => setNoTeamsDialogVisible(false)}
        onCreateTeam={canCreateTeam ? handleCreateTeam : undefined}
      />

      <SelectFormatModal
        visible={selectFormatVisible}
        selecting={selectingFormat}
        errorMessage={selectFormatError}
        onCancel={() => {
          if (!selectingFormat) {
            setSelectFormatVisible(false);
            setSelectFormatError(null);
          }
        }}
        onSelect={(format) => void handleFormatSelect(format)}
      />

      <GroupSetupRequiredDialog
        visible={setupRequiredVisible}
        canCreateGroup={canManageGroups}
        onCancel={() => setSetupRequiredVisible(false)}
        onCreateGroup={canManageGroups ? handleCreateGroup : undefined}
      />
    </>
  );
}
