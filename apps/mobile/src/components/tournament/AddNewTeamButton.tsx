import { View } from 'react-native';

import { Button } from '../ui/Button';

export interface AddNewTeamButtonProps {
  onPress: () => void;
  className?: string;
}

/** Shared primary CTA for adding a team — empty and populated Teams tab. */
export function AddNewTeamButton({
  onPress,
  className,
}: AddNewTeamButtonProps): React.ReactElement {
  return (
    <View className={className}>
      <Button
        label="Add New Team"
        variant="primary"
        onPress={onPress}
        className="h-12 w-full"
      />
    </View>
  );
}
