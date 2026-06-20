import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { STANDARD_MATCH_PENALTY_RUNS } from '@acc/types';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface PenaltyTeamOption {
  teamId: string;
  label: string;
}

export interface PenaltyRunsDialogProps {
  visible: boolean;
  teamOptions: readonly PenaltyTeamOption[];
  onCancel: () => void;
  onConfirm: (teamId: string) => void;
}

function TeamRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-control border px-3 py-3 active:opacity-80 ${
        selected ? 'border-2 border-primary bg-primary-container' : 'border-outline-variant bg-surface'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text className="min-w-0 flex-1 font-sans-semibold text-base text-on-surface">{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
    </Pressable>
  );
}

/** Standard 5-run penalty picker — More Options → Penalty (§12.1). */
export function PenaltyRunsDialog({
  visible,
  teamOptions,
  onCancel,
  onConfirm,
}: PenaltyRunsDialogProps): React.ReactElement {
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTeamId(null);
    }
  }, [visible]);

  const canConfirm = teamId != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Penalty Runs</Text>
            <Pressable
              onPress={onCancel}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          <View className="gap-3 p-4">
            <Text className="font-sans text-sm text-on-surface-variant">
              Award {STANDARD_MATCH_PENALTY_RUNS} Penalty runs to?
            </Text>

            <View className="gap-2">
              {teamOptions.map((team) => (
                <TeamRow
                  key={team.teamId}
                  label={team.label}
                  selected={teamId === team.teamId}
                  onPress={() => setTeamId(team.teamId)}
                />
              ))}
            </View>

            <Button
              label="Confirm Award"
              disabled={!canConfirm}
              onPress={() => {
                if (teamId) onConfirm(teamId);
              }}
              className="h-11"
            />
            <Button label="Cancel" variant="outline" onPress={onCancel} className="h-11" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
