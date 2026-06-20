import type { TeamSummary } from '@acc/types';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, View } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { canCreateTournamentTeam } from '../../lib/can-create-team';
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
}

function TeamsSectionHeading({ label }: { label: string }): React.ReactElement {
  return (
    <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
      {label}
    </Text>
  );
}

/** Tournament Teams tab — empty state or populated team list. */
export function TournamentTeamsTab({
  tournamentId,
  teams,
  numberOfTeams,
  myTeamId = null,
}: TournamentTeamsTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canCreateTeam = canCreateTournamentTeam(user);
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
        {canCreateTeam ? (
          <AddNewTeamButton
            className="mt-8 w-full max-w-xs"
            onPress={openAddTeam}
            disabled={atTeamCap}
            disabledNote={atTeamCap ? 'Team limit reached' : undefined}
          />
        ) : (
          <Text className="mt-8 text-center font-sans text-base text-on-surface-variant">
            No teams added yet.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="gap-3">
      {canCreateTeam ? (
        <AddNewTeamButton
          onPress={openAddTeam}
          disabled={atTeamCap}
          disabledNote={atTeamCap ? 'Team limit reached' : undefined}
        />
      ) : null}

      {myTeam ? (
        <View className="gap-3">
          <TeamsSectionHeading label="My Team" />
          <TeamListItem team={myTeam} onPress={() => openTeamDetail(myTeam.id)} />
        </View>
      ) : null}

      {myTeam ? (
        <View className="gap-3">
          <TeamsSectionHeading label="Other Teams" />
          {otherTeams.length === 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">No other teams yet.</Text>
          ) : (
            otherTeams.map((team) => (
              <TeamListItem
                key={team.id}
                team={team}
                onPress={() => openTeamDetail(team.id)}
              />
            ))
          )}
        </View>
      ) : (
        teams.map((team) => (
          <TeamListItem
            key={team.id}
            team={team}
            onPress={() => openTeamDetail(team.id)}
          />
        ))
      )}
    </View>
  );
}
