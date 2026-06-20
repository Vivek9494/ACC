import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCenterSevakTabConfig } from '../../lib/center-sevak-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

export interface CenterSevakTabShellProps {
  activeKey: string;
  children: ReactNode;
}

/** Placeholder tab screens share the Center Sevak tab bar below their content. */
export function CenterSevakTabShell({
  activeKey,
  children,
}: CenterSevakTabShellProps): React.ReactElement {
  const tabConfig = useCenterSevakTabConfig(activeKey);

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
