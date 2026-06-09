import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';

export default function AdminUsersTabScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1 px-4 pt-4">
        <Text className="font-sans-bold text-2xl text-on-surface">Users</Text>
        <Card className="mt-6 gap-2">
          <Text className="font-sans-bold text-lg text-on-surface">Coming soon</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            User management will be available in a future release.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}
