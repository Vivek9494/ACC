import { Modal, Pressable, View } from 'react-native';

import { scheduleMatchesGuardMessage } from '@acc/types';

import { Button } from './Button';
import { INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

export interface ScheduleMatchesNoTeamsDialogProps {
  visible: boolean;
  teamCount: number;
  canCreateTeam: boolean;
  onCancel: () => void;
  onCreateTeam?: () => void;
}

/**
 * Shown when an organizer taps Schedule Matches but the tournament has fewer than two teams.
 */
export function ScheduleMatchesNoTeamsDialog({
  visible,
  teamCount,
  canCreateTeam,
  onCancel,
  onCreateTeam,
}: ScheduleMatchesNoTeamsDialogProps): React.ReactElement {
  const message = scheduleMatchesGuardMessage(teamCount, canCreateTeam);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-surface p-5"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="font-sans-bold text-lg text-on-surface">Schedule Matches</Text>
          <Text className="font-sans text-sm leading-5 text-on-surface-variant">{message}</Text>
          {canCreateTeam ? (
            <Button label="Create Team" onPress={onCreateTeam} className="h-12 w-full" />
          ) : null}
          <Button
            variant="outline"
            label="Cancel"
            onPress={onCancel}
            className="h-12 w-full border-primary"
            textClassName="text-primary"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
