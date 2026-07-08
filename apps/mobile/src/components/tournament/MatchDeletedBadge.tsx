import { View } from 'react-native';

import { Text } from '../ui/Text';

/** Admin-only badge for soft-deleted tournament match cards. */
export function MatchDeletedBadge(): React.ReactElement {
  return (
    <View className="self-start rounded-full bg-on-surface/80 px-3 py-1">
      <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-text-inverse">
        Deleted
      </Text>
    </View>
  );
}
