import { formatRegistrationSkillRating } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../../ui/Text';

function Stat({ label, value }: { label: string; value: number | null }): React.ReactElement {
  return (
    <View className="min-w-[44px] flex-1 items-center">
      <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </Text>
      <Text className="font-sans-bold text-base text-primary">
        {formatRegistrationSkillRating(value)}
      </Text>
    </View>
  );
}

/** Compact BAT / BOWL / FIELD row for Verify Players cards. */
export function VerifyPlayerRatingsRow({
  batting,
  bowling,
  fielding,
}: {
  batting: number | null;
  bowling: number | null;
  fielding: number | null;
}): React.ReactElement {
  return (
    <View className="mt-2 flex-row gap-3">
      <Stat label="Bat" value={batting} />
      <Stat label="Bowl" value={bowling} />
      <Stat label="Field" value={fielding} />
    </View>
  );
}
