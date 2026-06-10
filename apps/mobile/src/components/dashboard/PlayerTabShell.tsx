import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerTabConfig } from '../../lib/player-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

export interface PlayerTabShellProps {
  activeKey: string;
  children: ReactNode;
}

/** Placeholder tab screens share the Player tab bar below their content. */
export function PlayerTabShell({ activeKey, children }: PlayerTabShellProps): React.ReactElement {
  const tabConfig = usePlayerTabConfig(activeKey);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1">{children}</View>
      <BottomTabBar
        tabs={tabConfig.tabs}
        activeKey={tabConfig.activeKey}
        onTabPress={tabConfig.onTabPress}
      />
    </SafeAreaView>
  );
}
