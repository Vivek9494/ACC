import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';

export default function AdminGeographyTabScreen(): React.ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 gap-4 px-4 pt-4">
        <Text className="font-sans-bold text-2xl text-on-surface">Geography</Text>
        <Card accent onPress={() => router.push('/admin/provinces')} className="gap-2">
          <Text className="font-sans-bold text-lg text-on-surface">Provinces & Centers</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Manage provinces, centers, and archive records.
          </Text>
        </Card>
        <Pressable onPress={() => router.push('/admin/provinces/new')}>
          <Text className="font-sans-semibold text-sm text-primary">+ Add Province</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
