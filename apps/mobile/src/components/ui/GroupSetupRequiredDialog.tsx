import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { Button } from './Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

export interface GroupSetupRequiredDialogProps {
  visible: boolean;
  canCreateGroup: boolean;
  onCancel: () => void;
  onCreateGroup?: () => void;
}

/** Shown when Group Stage + Knockout is chosen but no groups exist yet. */
export function GroupSetupRequiredDialog({
  visible,
  canCreateGroup,
  onCancel,
  onCreateGroup,
}: GroupSetupRequiredDialogProps): React.ReactElement {
  const message = canCreateGroup
    ? 'Create Groups and add teams in the groups.'
    : 'Groups have not been set up for this tournament yet. Please check back later.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-surface p-5"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center">
            <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-primary-container/20">
              <Ionicons name="people-outline" size={28} color={FIELD_ORANGE} />
            </View>
            <Text className="text-center font-sans-bold text-lg text-on-surface">Setup Required</Text>
          </View>
          <Text className="text-center font-sans text-sm leading-5 text-on-surface-variant">
            {message}
          </Text>
          {canCreateGroup ? (
            <Button label="Create Group" onPress={onCreateGroup} className="h-12 w-full" />
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
