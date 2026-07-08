import type { ReactNode } from 'react';
import { View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { ListRowIconButton } from '../ui/ListRowIconButton';

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
  headerTrailing?: ReactNode;
  editMode?: boolean;
  onRemoveTeam?: (teamId: string) => void;
  editFooter?: ReactNode;
}

export function TournamentGroupCardHeader({
  groupName,
  trailing,
}: {
  groupName: string;
  trailing?: ReactNode;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className="h-5 w-1 rounded-full bg-primary" accessibilityElementsHidden />
        <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
          {groupName}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

/** @deprecated Use header without team count — kept for Points Table reuse. */
export function TournamentGroupCardHeaderWithCount({
  groupName,
  teamCount,
}: {
  groupName: string;
  teamCount: number;
}): React.ReactElement {
  return (
    <TournamentGroupCardHeader
      groupName={groupName}
      trailing={
        <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
          {teamCount} TEAMS
        </Text>
      }
    />
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
  editMode = false,
  onRemove,
}: {
  name: string;
  logoUrl: string | null;
  showBottomDivider?: boolean;
  boldName?: boolean;
  editMode?: boolean;
  onRemove?: () => void;
}): React.ReactElement {
  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-3 ${showBottomDivider ? 'border-b border-separator' : ''}`}
    >
      <TeamAvatar name={name} logoUrl={logoUrl} size="xs" />
      <Text
        className={`min-w-0 flex-1 text-sm text-on-surface ${boldName ? 'font-sans-bold' : 'font-sans'}`}
        numberOfLines={1}
      >
        {name}
      </Text>
      {editMode && onRemove ? (
        <ListRowIconButton
          icon="remove-circle-outline"
          accessibilityLabel={`Remove ${name} from group`}
          onPress={onRemove}
        />
      ) : null}
    </View>
  );
}

/**
 * Shared group card shell — accent-dash header, white card, team list (Groups tab).
 */
export function TournamentGroupCard({
  groupName,
  teams,
  showGroupHeader = true,
  emptyMessage = 'No teams assigned yet.',
  headerTrailing,
  editMode = false,
  onRemoveTeam,
  editFooter,
}: TournamentGroupCardProps): React.ReactElement {
  const teamCount = teams.length;
  const showTeamList = editMode || teamCount > 0;

  return (
    <View
      className="overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={INPUT_SHADOW_STYLE}
    >
      {showGroupHeader ? (
        <TournamentGroupCardHeader groupName={groupName} trailing={headerTrailing} />
      ) : null}

      {!showTeamList ? (
        <Text className="px-4 py-4 text-center font-sans text-sm text-on-surface-variant">
          {emptyMessage}
        </Text>
      ) : (
        <View>
          {teamCount > 0 ? <GroupCardTeamHeaderRow /> : null}
          {teams.map((team) => (
            <GroupCardTeamRow
              key={team.id}
              name={team.name}
              logoUrl={team.logoUrl}
              editMode={editMode}
              onRemove={onRemoveTeam ? () => onRemoveTeam(team.id) : undefined}
            />
          ))}
          {editMode && teamCount === 0 ? (
            <Text className="px-4 pb-2 text-center font-sans text-sm text-on-surface-variant">
              {emptyMessage}
            </Text>
          ) : null}
        </View>
      )}

      {editFooter}
    </View>
  );
}
