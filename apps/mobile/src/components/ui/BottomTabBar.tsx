import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

cssInterop(Ionicons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

cssInterop(MaterialCommunityIcons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type BottomTabItem =
  | {
      key: string;
      label: string;
      icon: IoniconName;
      iconLibrary?: 'ionicons';
    }
  | {
      key: string;
      label: string;
      icon: MaterialCommunityIconName;
      iconLibrary: 'material-community';
    };

export interface BottomTabBarProps {
  tabs: BottomTabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
}

/**
 * Configurable bottom tab bar — active tab uses a solid primary-orange pill with
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
      className="border-t border-outline-variant bg-surface px-2 pt-2"
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
              className={
                active
                  ? 'flex-1 items-center rounded-xl bg-primary px-1 py-1'
                  : 'flex-1 items-center bg-transparent py-1'
              }
            >
              {tab.iconLibrary === 'material-community' ? (
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={22}
                  className={active ? 'text-on-primary' : 'text-on-surface-variant'}
                />
              ) : (
                <Ionicons
                  name={tab.icon}
                  size={22}
                  className={active ? 'text-on-primary' : 'text-on-surface-variant'}
                />
              )}
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
