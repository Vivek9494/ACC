import { View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';

export interface GroupCardTeam {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface TournamentGroupCardProps {
  groupName: string;
  teams: GroupCardTeam[];
  showGroupHeader?: boolean;
  emptyMessage?: string;
  /** When provided, renders beside a fixed team column (Points Table stats). */
  statsContent?: React.ReactNode;
}

function TournamentGroupCardHeader({
  groupName,
  teamCount,
}: {
  groupName: string;
  teamCount: number;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className="h-5 w-1 rounded-full bg-primary" accessibilityElementsHidden />
        <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
          {groupName}
        </Text>
      </View>
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
        {teamCount} TEAMS
      </Text>
    </View>
  );
}

/** Light column header row — matches Points Table TEAM header. */
export function GroupCardTeamHeaderRow(): React.ReactElement {
  return (
    <View className="border-b border-separator px-3 py-2">
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
        Team
      </Text>
    </View>
  );
}

/** Single team row — avatar + name, same rhythm as Points Table TEAM column. */
export function GroupCardTeamRow({
  name,
  logoUrl,
  showBottomDivider = false,
  boldName = false,
}: {
  name: string;
  logoUrl: string | null;
  showBottomDivider?: boolean;
  boldName?: boolean;
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
    >
      <TeamAvatar name={name} logoUrl={logoUrl} size="xs" />
      <Text
        className={`flex-1 text-sm text-on-surface ${boldName ? 'font-sans-bold' : 'font-sans'}`}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

/**
 * Shared group card shell — accent-dash header, white card, Team column header.
 * Pass `statsContent` for the Points Table stat columns; omit for Groups tab team-only list.
 */
export function TournamentGroupCard({
  groupName,
  teams,
  showGroupHeader = true,
  emptyMessage = 'No teams assigned yet.',
  statsContent,
}: TournamentGroupCardProps): React.ReactElement {
  const teamCount = teams.length;

  return (
    <View
      className="overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={INPUT_SHADOW_STYLE}
    >
      {showGroupHeader ? (
        <TournamentGroupCardHeader groupName={groupName} teamCount={teamCount} />
      ) : null}

      {teamCount === 0 ? (
        <Text className="px-4 py-4 text-center font-sans text-sm text-on-surface-variant">
          {emptyMessage}
        </Text>
      ) : statsContent ? (
        <View className="flex-row">
          <View className="w-[42%] max-w-[160px] shrink-0 border-r border-separator">
            <GroupCardTeamHeaderRow />
            {teams.map((team, index) => (
              <GroupCardTeamRow
                key={team.id}
                name={team.name}
                logoUrl={team.logoUrl}
                boldName
                showBottomDivider={index < teamCount - 1}
              />
            ))}
          </View>
          {statsContent}
        </View>
      ) : (
        <View>
          <GroupCardTeamHeaderRow />
          {teams.map((team) => (
            <GroupCardTeamRow key={team.id} name={team.name} logoUrl={team.logoUrl} />
          ))}
        </View>
      )}
    </View>
  );
}
