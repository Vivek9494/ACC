import { View } from 'react-native';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface MatchResultBannerProps {
  resultLine: string;
}

/** Prominent match result — shared by live scoring header area and completed scorecard. */
export function MatchResultBanner({ resultLine }: MatchResultBannerProps): React.ReactElement {
  return (
    <View
      className="rounded-xl border border-primary bg-primary-container/40 px-4 py-3"
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-semibold text-base leading-6 text-primary">{resultLine}</Text>
    </View>
  );
}
