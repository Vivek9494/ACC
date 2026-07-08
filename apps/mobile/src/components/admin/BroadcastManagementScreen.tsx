import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminBroadcastSection } from './AdminBroadcastSection';
import { BroadcastHistoryList } from './BroadcastHistoryList';
import { KeyboardAwareFormContainer } from '../ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../ui/ScreenHeader';

/** Admin / Club Manager — post broadcasts and browse history. */
export function BroadcastManagementScreen(): React.ReactElement {
  const router = useRouter();
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Broadcast Message" onBack={() => router.back()} />
      <KeyboardAwareFormContainer className="flex-1">
        <View className="border-b border-outline-variant/60 px-4 pb-4 pt-2">
          <AdminBroadcastSection onPosted={() => setHistoryRefreshKey((key) => key + 1)} />
        </View>
        <BroadcastHistoryList refreshKey={historyRefreshKey} />
      </KeyboardAwareFormContainer>
    </SafeAreaView>
  );
}
