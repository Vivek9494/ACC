import { BallType, type TeamDetailPlayerRow, type TeamDetailView } from '@acc/types';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ApiRequestError, assignTeamRoles } from '../../lib/api';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

type LeadershipRole = 'captain' | 'viceCaptain' | 'manager';

export interface TeamLeadershipSectionProps {
  tournamentId: string;
  teamId: string;
  detail: TeamDetailView;
  onUpdated: () => void;
}

function playerName(player: TeamDetailPlayerRow | undefined): string {
  if (!player) {
    return 'Not assigned';
  }
  return `${player.firstName} ${player.lastName}`;
}

function excludedUserIds(
  detail: TeamDetailView,
  pickerRole: LeadershipRole,
): string[] {
  const captain = detail.players.find((player) => player.isCaptain)?.userId ?? null;
  const viceCaptain = detail.players.find((player) => player.isViceCaptain)?.userId ?? null;
  const manager = detail.players.find((player) => player.isManager)?.userId ?? null;

  if (pickerRole === 'captain') {
    return [viceCaptain, manager].filter((id): id is string => id != null);
  }
  if (pickerRole === 'viceCaptain') {
    return [captain, manager].filter((id): id is string => id != null);
  }
  return [captain, viceCaptain].filter((id): id is string => id != null);
}

/** Admin / Club Manager assigns Captain, Vice-Captain, and Manager from the team roster. */
export function TeamLeadershipSection({
  tournamentId,
  teamId,
  detail,
  onUpdated,
}: TeamLeadershipSectionProps): React.ReactElement | null {
  const [pickerRole, setPickerRole] = useState<LeadershipRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!detail.canAssignTeamRoles) {
    return null;
  }

  const showManager = detail.ballType !== BallType.Leather;
  const captain = detail.players.find((player) => player.isCaptain);
  const viceCaptain = detail.players.find((player) => player.isViceCaptain);
  const manager = detail.players.find((player) => player.isManager);

  const candidates =
    pickerRole == null
      ? detail.players
      : detail.players.filter(
          (player) => !excludedUserIds(detail, pickerRole).includes(player.userId),
        );

  async function saveRole(role: LeadershipRole, userId: string | null): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await assignTeamRoles(tournamentId, teamId, {
        ...(role === 'captain'
          ? { captainUserId: userId }
          : role === 'viceCaptain'
            ? { viceCaptainUserId: userId }
            : { managerUserId: userId }),
      });
      setPickerRole(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update team role.');
    } finally {
      setSaving(false);
    }
  }

  function pickerTitle(role: LeadershipRole): string {
    if (role === 'captain') {
      return 'Select Captain';
    }
    if (role === 'viceCaptain') {
      return 'Select Vice-Captain';
    }
    return 'Select Manager';
  }

  return (
    <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <Text className="font-sans-bold text-lg text-on-surface">Team Leadership</Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        Assign one Captain, Vice-Captain
        {showManager ? ', and Manager' : ''} from this roster. Each role must be a different player.
      </Text>

      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans-semibold text-sm text-on-surface-variant">Captain</Text>
            <Text className="font-sans-bold text-base text-on-surface">{playerName(captain)}</Text>
          </View>
          <Button
            variant="outline"
            label="Change"
            onPress={() => setPickerRole('captain')}
            disabled={saving || detail.players.length === 0}
            className="h-9 rounded-full px-4"
            textClassName="text-xs"
          />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans-semibold text-sm text-on-surface-variant">Vice-Captain</Text>
            <Text className="font-sans-bold text-base text-on-surface">
              {playerName(viceCaptain)}
            </Text>
          </View>
          <Button
            variant="outline"
            label="Change"
            onPress={() => setPickerRole('viceCaptain')}
            disabled={saving || detail.players.length === 0}
            className="h-9 rounded-full px-4"
            textClassName="text-xs"
          />
        </View>

        {showManager ? (
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-sm text-on-surface-variant">Manager</Text>
              <Text className="font-sans-bold text-base text-on-surface">{playerName(manager)}</Text>
            </View>
            <Button
              variant="outline"
              label="Change"
              onPress={() => setPickerRole('manager')}
              disabled={saving || detail.players.length === 0}
              className="h-9 rounded-full px-4"
              textClassName="text-xs"
            />
          </View>
        ) : null}
      </View>

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

      <Modal visible={pickerRole != null} transparent animationType="slide">
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPickerRole(null)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-background px-4 pb-8 pt-4" onPress={() => undefined}>
            <Text className="font-sans-bold text-lg text-on-surface">
              {pickerRole ? pickerTitle(pickerRole) : ''}
            </Text>
            <Pressable
              className="mt-4 border-b border-outline-variant py-3"
              onPress={() => pickerRole && void saveRole(pickerRole, null)}
              disabled={saving}
            >
              <Text className="font-sans-semibold text-base text-on-surface-variant">Clear assignment</Text>
            </Pressable>
            {candidates.map((player) => (
              <Pressable
                key={player.userId}
                className="border-b border-outline-variant py-3"
                onPress={() => pickerRole && void saveRole(pickerRole, player.userId)}
                disabled={saving}
              >
                <Text className="font-sans-semibold text-base text-on-surface">
                  {player.firstName} {player.lastName}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
