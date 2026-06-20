import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGuestTabConfig } from '../../lib/guest-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

export interface GuestTabShellProps {
  activeKey: string;
  children: ReactNode;
}

export function GuestTabShell({ activeKey, children }: GuestTabShellProps): React.ReactElement {
  const tabConfig = useGuestTabConfig(activeKey);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1">{children}</View>
      <BottomTabBar
        tabs={tabConfig.tabs}
        activeKey={tabConfig.activeKey}
        onTabPress={tabConfig.onTabPress}
      />
    </SafeAreaView>
  );
}
