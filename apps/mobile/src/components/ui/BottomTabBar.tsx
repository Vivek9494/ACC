import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

export interface BottomTabItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

export interface BottomTabBarProps {
  tabs: BottomTabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
}

/**
 * Configurable bottom tab bar — active tab uses a filled primary-orange pill with
 * white icon and label (dashboard design).
 */
export function BottomTabBar({
  tabs,
  activeKey,
  onTabPress,
}: BottomTabBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-outline-variant bg-white px-2 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="flex-row items-center justify-between">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center py-1 ${active ? 'rounded-xl bg-primary px-1' : ''}`}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={active ? '#ffffff' : '#5a4136'}
              />
              <Text
                className={`mt-0.5 font-sans-semibold text-[10px] ${
                  active ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
