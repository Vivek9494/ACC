import { Ionicons } from '@expo/vector-icons';
import {
  MATCH_SCHEDULING_FORMAT_LABELS,
  MATCH_SCHEDULING_FORMAT_OPTIONS,
  type MatchSchedulingFormat,
} from '@acc/types';
import { Modal, Pressable, View } from 'react-native';

import { Button } from './Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

const FORMAT_ICONS = {
  ROUND_ROBIN: 'repeat',
  GROUP_STAGE_KNOCKOUT: 'git-branch-outline',
  MANUAL: 'pencil-outline',
} as const satisfies Record<MatchSchedulingFormat, string>;

export interface SelectFormatModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (format: MatchSchedulingFormat) => void;
  selecting?: boolean;
  errorMessage?: string | null;
}

/** Schedule Matches — pick Round Robin, Group Stage + Knockout, or Manual. */
export function SelectFormatModal({
  visible,
  onCancel,
  onSelect,
  selecting = false,
  errorMessage,
}: SelectFormatModalProps): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-white p-5"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-center font-sans-bold text-lg text-on-surface">Select Format</Text>

          <View className="gap-3">
            {MATCH_SCHEDULING_FORMAT_OPTIONS.map((format) => (
              <Pressable
                key={format}
                onPress={() => onSelect(format)}
                disabled={selecting}
                className="flex-row items-center gap-3 rounded-control border border-primary/40 bg-surface-container-lowest p-4 active:opacity-80 disabled:opacity-60"
                accessibilityRole="button"
                accessibilityLabel={MATCH_SCHEDULING_FORMAT_LABELS[format]}
              >
                <Ionicons name={FORMAT_ICONS[format]} size={22} color={FIELD_ORANGE} />
                <Text className="flex-1 font-sans-semibold text-base text-on-surface">
                  {MATCH_SCHEDULING_FORMAT_LABELS[format]}
                </Text>
              </Pressable>
            ))}
          </View>

          {errorMessage ? (
            <Text className="text-center font-sans text-sm text-error">{errorMessage}</Text>
          ) : null}

          <Button
            variant="outline"
            label="Cancel"
            onPress={onCancel}
            disabled={selecting}
            className="h-12 w-full border-primary"
            textClassName="text-primary"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
