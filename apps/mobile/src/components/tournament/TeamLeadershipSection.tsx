import type { TeamDetailPlayerRow, TeamDetailView } from '@acc/types';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ApiRequestError, assignTeamRoles } from '../../lib/api';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

type LeadershipRole = 'captain' | 'viceCaptain';

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

/** Club Manager assigns Captain and Vice-Captain from the team roster. */
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

  const captain = detail.players.find((player) => player.isCaptain);
  const viceCaptain = detail.players.find((player) => player.isViceCaptain);

  const excludedUserId = pickerRole === 'captain' ? viceCaptain?.userId : captain?.userId;
  const candidates = detail.players.filter((player) => player.userId !== excludedUserId);

  async function saveRole(role: LeadershipRole, userId: string | null): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await assignTeamRoles(tournamentId, teamId, {
        ...(role === 'captain' ? { captainUserId: userId } : { viceCaptainUserId: userId }),
      });
      setPickerRole(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update team role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <Text className="font-sans-bold text-lg text-on-surface">Team Leadership</Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        Assign one Captain and one Vice-Captain from this roster. They must be different people.
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
      </View>

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

      <Modal visible={pickerRole != null} transparent animationType="slide">
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPickerRole(null)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-background px-4 pb-8 pt-4" onPress={() => undefined}>
            <Text className="font-sans-bold text-lg text-on-surface">
              {pickerRole === 'captain' ? 'Select Captain' : 'Select Vice-Captain'}
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
