import { View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface AddNewTeamButtonProps {
  onPress: () => void;
  disabled?: boolean;
  disabledNote?: string;
  className?: string;
}

/** Shared primary CTA for adding a team — empty and populated Teams tab. */
export function AddNewTeamButton({
  onPress,
  disabled = false,
  disabledNote,
  className,
}: AddNewTeamButtonProps): React.ReactElement {
  return (
    <View className={`gap-2 ${className ?? ''}`.trim()}>
      <Button
        label="Add New Team"
        variant="primary"
        onPress={onPress}
        disabled={disabled}
        className="h-12 w-full"
      />
      {disabled && disabledNote ? (
        <Text className="text-center font-sans text-sm text-on-surface-variant">{disabledNote}</Text>
      ) : null}
    </View>
  );
}
