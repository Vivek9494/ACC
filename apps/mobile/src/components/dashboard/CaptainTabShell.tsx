import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCaptainTabConfig } from '../../lib/captain-tabs';
import { BottomTabBar } from '../ui/BottomTabBar';

export interface CaptainTabShellProps {
  activeKey: string;
  children: ReactNode;
}

/** Placeholder tab screens share the Captain tab bar below their content. */
export function CaptainTabShell({ activeKey, children }: CaptainTabShellProps): React.ReactElement {
  const tabConfig = useCaptainTabConfig(activeKey);

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
