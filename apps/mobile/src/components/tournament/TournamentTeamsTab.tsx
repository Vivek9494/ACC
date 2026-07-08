import { TEAM_FORM_MESSAGES, type TeamSummary } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Image, View } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { canCreateTournamentTeam } from '../../lib/can-create-team';
import { canManageTournamentTeam } from '../../lib/can-manage-tournament-team';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';
import { ApiRequestError, deleteTeam } from '../../lib/api';
import { Text } from '../ui/Text';
import { AddNewTeamButton } from './AddNewTeamButton';
import { TeamListItem } from './TeamListItem';

const BatsmanIllustration = require('../../../assets/illustrations/batsman.png') as number;

export interface TournamentTeamsTabProps {
  tournamentId: string;
  teams: TeamSummary[];
  numberOfTeams: number;
  /** Viewer roster team in this tournament; null when not on a team. */
  myTeamId?: string | null;
  onTeamsChanged?: () => void;
}

function TeamsSectionHeading({ label }: { label: string }): React.ReactElement {
  return (
    <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
      {label}
    </Text>
  );
}

function TeamRow({
  team,
  tournamentId,
  canManage,
  onOpenDetail,
  onTeamsChanged,
}: {
  team: TeamSummary;
  tournamentId: string;
  canManage: boolean;
  onOpenDetail: (teamId: string) => void;
  onTeamsChanged?: () => void;
}): React.ReactElement {
  const router = useRouter();

  const openEdit = useCallback(() => {
    router.push(`/tournaments/${tournamentId}/teams/${team.id}/edit`);
  }, [router, team.id, tournamentId]);

  const requestDelete = useCallback(() => {
    if (team.hasMatches) {
      Alert.alert('Cannot delete team', TEAM_FORM_MESSAGES.delete.hasMatches);
      return;
    }
    confirmDestructiveDeleteAlert({
      title: TEAM_FORM_MESSAGES.delete.confirmTitle,
      message: TEAM_FORM_MESSAGES.delete.confirmMessage(team.name),
      onConfirm: async () => {
        try {
          await deleteTeam(tournamentId, team.id);
          onTeamsChanged?.();
        } catch (err) {
          Alert.alert(
            'Could not delete team',
            err instanceof ApiRequestError ? err.message : 'Could not delete the team.',
          );
        }
      },
    });
  }, [onTeamsChanged, team, tournamentId]);

  return (
    <TeamListItem
      team={team}
      onPress={() => onOpenDetail(team.id)}
      onEdit={canManage ? openEdit : undefined}
      onDelete={canManage && !team.hasMatches ? requestDelete : undefined}
    />
  );
}

/** Tournament Teams tab — empty state or populated team list. */
export function TournamentTeamsTab({
  tournamentId,
  teams,
  numberOfTeams,
  myTeamId = null,
  onTeamsChanged,
}: TournamentTeamsTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canCreateTeam = canCreateTournamentTeam(user);
  const canManage = canManageTournamentTeam(user);
  const atTeamCap = teams.length >= numberOfTeams;

  const { myTeam, otherTeams } = useMemo(() => {
    if (!myTeamId) {
      return { myTeam: null, otherTeams: teams };
    }
    const own = teams.find((team) => team.id === myTeamId) ?? null;
    return {
      myTeam: own,
      otherTeams: own ? teams.filter((team) => team.id !== myTeamId) : teams,
    };
  }, [myTeamId, teams]);

  function openAddTeam(): void {
    router.push(`/tournaments/${tournamentId}/add-team`);
  }

  function openTeamDetail(teamId: string): void {
    router.push(`/tournaments/${tournamentId}/teams/${teamId}`);
  }

  if (teams.length === 0) {
    return (
      <View className="items-center px-6 py-12">
        <Image
          source={BatsmanIllustration}
          className="h-40 w-40"
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        {canCreateTeam && !atTeamCap ? (
          <AddNewTeamButton
            className="mt-8 w-full max-w-xs"
            onPress={openAddTeam}
          />
        ) : !canCreateTeam ? (
          <Text className="mt-8 text-center font-sans text-base text-on-surface-variant">
            No teams added yet.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3">
      {canCreateTeam && !atTeamCap ? (
        <AddNewTeamButton onPress={openAddTeam} />
      ) : null}

      {myTeam ? (
        <View className="gap-3">
          <TeamsSectionHeading label="My Team" />
          <TeamRow
            team={myTeam}
            tournamentId={tournamentId}
            canManage={canManage}
            onOpenDetail={openTeamDetail}
            onTeamsChanged={onTeamsChanged}
          />
        </View>
      ) : null}

      {myTeam ? (
        <View className="gap-3">
          <TeamsSectionHeading label="Other Teams" />
          {otherTeams.length === 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">No other teams yet.</Text>
          ) : (
            otherTeams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                tournamentId={tournamentId}
                canManage={canManage}
                onOpenDetail={openTeamDetail}
                onTeamsChanged={onTeamsChanged}
              />
            ))
          )}
        </View>
      ) : (
        teams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            tournamentId={tournamentId}
            canManage={canManage}
            onOpenDetail={openTeamDetail}
            onTeamsChanged={onTeamsChanged}
          />
        ))
      )}
    </View>
  );
}
