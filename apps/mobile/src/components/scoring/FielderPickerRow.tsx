import { Ionicons } from '@expo/vector-icons';
import type { FielderPickerPlayerRow } from '@acc/types';
import { View } from 'react-native';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

export interface FielderPickerRowProps {
  row: FielderPickerPlayerRow;
  selected: boolean;
  onPress: (userId: string) => void;
}

export function FielderPickerRow({
  row,
  selected,
  onPress,
}: FielderPickerRowProps): React.ReactElement {
  return (
    <Card
      onPress={() => onPress(row.userId)}
      className={[
        'flex-row items-center gap-4 rounded-control',
        selected ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant',
      ].join(' ')}
    >
      <PlayerAvatar
        firstName={row.firstName}
        profilePhotoUrl={row.profilePhotoUrl}
        size="md"
        highlighted={selected}
      />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface">
          {row.firstName} {row.lastName}
        </Text>
        {row.isCurrentBowler ? (
          <Text className="mt-0.5 font-sans text-sm text-on-surface-variant">Bowler</Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={24} color={FIELD_ORANGE} /> : null}
    </Card>
  );
}
