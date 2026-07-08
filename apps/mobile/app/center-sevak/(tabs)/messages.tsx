import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../../src/components/ui/Text';

export default function CenterSevakMessagesScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Text className="px-4 pt-4 font-sans-bold text-xl text-on-surface">Messages</Text>
      <Text className="mt-2 px-4 font-sans text-sm text-on-surface-variant">Coming soon.</Text>
    </SafeAreaView>
  );
}
