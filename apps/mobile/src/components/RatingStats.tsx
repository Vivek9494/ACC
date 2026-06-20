import { formatRegistrationSkillRating } from '@acc/types';
import { View } from 'react-native';

import { Text } from './ui/Text';

interface RatingStatsProps {
  batting: number | null;
  bowling: number | null;
  fielding: number | null;
}

function Stat({ label, value }: { label: string; value: number | null }): React.ReactElement {
  return (
    <View className="flex-1 items-center rounded-lg bg-surface-container-high px-2 py-2">
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className="mt-0.5 font-sans-bold text-base text-primary">
        {formatRegistrationSkillRating(value)}
      </Text>
    </View>
  );
}

/** BAT / BOWL / FIELD rating triple (integers 0–10). */
export function RatingStats({ batting, bowling, fielding }: RatingStatsProps): React.ReactElement {
  return (
    <View className="flex-row gap-2">
      <Stat label="Bat" value={batting} />
      <Stat label="Bowl" value={bowling} />
      <Stat label="Field" value={fielding} />
    </View>
  );
}
