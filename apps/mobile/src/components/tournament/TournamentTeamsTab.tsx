import type { TeamSummary } from '@acc/types';
import { useRouter } from 'expo-router';
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
}

/** Tournament Teams tab — empty state or populated team list. */
export function TournamentTeamsTab({
  tournamentId,
  teams,
  numberOfTeams,
}: TournamentTeamsTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canCreateTeam = canCreateTournamentTeam(user);
  const atTeamCap = teams.length >= numberOfTeams;

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
      {teams.map((team) => (
        <TeamListItem
          key={team.id}
          team={team}
          onPress={() => openTeamDetail(team.id)}
        />
      ))}
    </View>
  );
}
