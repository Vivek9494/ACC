import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../../src/components/ui/Text';

export default function ClubManagerStatsScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background px-4 pt-4" edges={['top']}>
      <Text className="font-sans-bold text-xl text-on-surface">Stats</Text>
      <Text className="mt-2 font-sans text-sm text-on-surface-variant">Coming soon.</Text>
    </SafeAreaView>
  );
}
