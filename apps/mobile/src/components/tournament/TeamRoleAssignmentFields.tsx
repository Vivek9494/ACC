import { BallType, type TeamDetailPlayerRow, type TeamDetailView } from '@acc/types';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiRequestError, assignTeamRoles } from '../../lib/api';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';

const UNASSIGNED_VALUE = '';

function playerLabel(player: TeamDetailPlayerRow): string {
  return `${player.firstName} ${player.lastName}`;
}

function roleOptions(
  players: TeamDetailPlayerRow[],
  excludedUserIds: string[],
): SelectOption[] {
  const excluded = new Set(excludedUserIds);
  return [
    { value: UNASSIGNED_VALUE, label: 'None' },
    ...players
      .filter((player) => !excluded.has(player.userId))
      .map((player) => ({ value: player.userId, label: playerLabel(player) })),
  ];
}

export interface TeamRoleAssignmentFieldsProps {
  tournamentId: string;
  teamId: string;
  detail: TeamDetailView;
  onUpdated: (detail: Pick<TeamDetailView, 'players'>) => void;
}

/** Captain / Vice-Captain / Manager pickers — Admin and Club Manager only. */
export function TeamRoleAssignmentFields({
  tournamentId,
  teamId,
  detail,
  onUpdated,
}: TeamRoleAssignmentFieldsProps): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captainUserId = detail.players.find((player) => player.isCaptain)?.userId ?? null;
  const viceCaptainUserId =
    detail.players.find((player) => player.isViceCaptain)?.userId ?? null;
  const managerUserId = detail.players.find((player) => player.isManager)?.userId ?? null;
  const showManager = detail.ballType !== BallType.Leather;

  const captainOptions = useMemo(
    () => roleOptions(detail.players, [viceCaptainUserId, managerUserId].filter(Boolean) as string[]),
    [detail.players, managerUserId, viceCaptainUserId],
  );
  const viceCaptainOptions = useMemo(
    () => roleOptions(detail.players, [captainUserId, managerUserId].filter(Boolean) as string[]),
    [captainUserId, detail.players, managerUserId],
  );
  const managerOptions = useMemo(
    () =>
      roleOptions(detail.players, [captainUserId, viceCaptainUserId].filter(Boolean) as string[]),
    [captainUserId, detail.players, viceCaptainUserId],
  );

  async function saveRole(
    patch: Partial<{
      captainUserId: string | null;
      viceCaptainUserId: string | null;
      managerUserId: string | null;
    }>,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const response = await assignTeamRoles(tournamentId, teamId, patch);
      const nextPlayers = detail.players.map((player) => ({
        ...player,
        isCaptain: player.userId === response.captainUserId,
        isViceCaptain: player.userId === response.viceCaptainUserId,
        isManager: player.userId === response.managerUserId,
      }));
      onUpdated({ players: nextPlayers });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update team role.');
    } finally {
      setSaving(false);
    }
  }

  function toUserId(value: string): string | null {
    return value === UNASSIGNED_VALUE ? null : value;
  }

  return (
    <View className="gap-4">
      <View>
        <Text className="font-sans-bold text-lg text-on-surface">Team Leadership</Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          Assign one Captain, Vice-Captain
          {showManager ? ', and Manager' : ''} from this roster. Each role must be a different player.
        </Text>
      </View>

      <Select
        label="Captain"
        placeholder={detail.players.length === 0 ? 'Add players to the team first' : 'Select captain'}
        value={captainUserId ?? UNASSIGNED_VALUE}
        options={captainOptions}
        onChange={(value) => void saveRole({ captainUserId: toUserId(value) })}
        disabled={saving || detail.players.length === 0}
      />

      <Select
        label="Vice-Captain"
        placeholder={
          detail.players.length === 0 ? 'Add players to the team first' : 'Select vice-captain'
        }
        value={viceCaptainUserId ?? UNASSIGNED_VALUE}
        options={viceCaptainOptions}
        onChange={(value) => void saveRole({ viceCaptainUserId: toUserId(value) })}
        disabled={saving || detail.players.length === 0}
      />

      {showManager ? (
        <Select
          label="Manager"
          placeholder={
            detail.players.length === 0 ? 'Add players to the team first' : 'Select manager'
          }
          value={managerUserId ?? UNASSIGNED_VALUE}
          options={managerOptions}
          onChange={(value) => void saveRole({ managerUserId: toUserId(value) })}
          disabled={saving || detail.players.length === 0}
        />
      ) : null}

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
    </View>
  );
}
