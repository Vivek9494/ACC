import { View } from 'react-native';

import { Text } from './ui/Text';
import { INPUT_SHADOW_STYLE } from './ui/fieldStyles';

export interface InningsNotStartedPlaceholderProps {
  teamName: string;
}

/** Shown when the second-innings tab is selected before that innings has begun. */
export function InningsNotStartedPlaceholder({
  teamName,
}: InningsNotStartedPlaceholderProps): React.ReactElement {
  return (
    <View
      className="items-center rounded-control border border-outline-variant bg-surface-container-lowest px-6 py-12"
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={2}>
        {teamName}
      </Text>
      <Text className="mt-2 font-sans text-sm text-on-surface-variant">Yet to bat</Text>
      <Text className="mt-1 font-sans text-xs text-on-surface-variant">Innings not started</Text>
    </View>
  );
}
