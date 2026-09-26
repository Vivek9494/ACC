import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TYPE } from '@/theme/typography';

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

/** Cap at caption; floor keeps micro-labels readable on narrow 5-tab bars. */
const LABEL_SIZE_MAX = TYPE.caption;
const LABEL_SIZE_MIN = 9;
/** Approximate average glyph width for Montserrat Regular (em). */
const MONTSERRAT_REGULAR_CHAR_EM = 0.55;
/** Horizontal chrome matching px-1.5 bar + gap-1 + px-0.5 tabs. */
const BAR_PAD_X = 12;
const TAB_GAP = 4;
const TAB_PAD_X = 4;

/**
 * One shared size for every tab label — sized so the longest label (e.g.
 * "Tournaments") fits on one line in an equal-width slot.
 */
function uniformTabLabelSize(screenWidth: number, labels: string[]): number {
  const tabCount = labels.length;
  if (tabCount === 0) return LABEL_SIZE_MAX;
  const longestLen = Math.max(1, ...labels.map((label) => label.length));
  const chrome = BAR_PAD_X + TAB_GAP * Math.max(0, tabCount - 1) + TAB_PAD_X * tabCount;
  const slotWidth = (screenWidth - chrome) / tabCount;
  const fitted = Math.floor((slotWidth * 0.96) / (longestLen * MONTSERRAT_REGULAR_CHAR_EM));
  return Math.min(LABEL_SIZE_MAX, Math.max(LABEL_SIZE_MIN, fitted));
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
  const { width: screenWidth } = useWindowDimensions();
  const labelFontSize = uniformTabLabelSize(
    screenWidth,
    tabs.map((tab) => tab.label),
  );
  const labelLineHeight = Math.round(labelFontSize * 1.25);

  return (
    <View
      className="border-t border-outline-variant bg-surface px-1.5 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="flex-row items-center gap-1">
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
                  ? 'min-w-0 flex-1 items-center rounded-xl bg-primary px-0.5 py-1.5'
                  : 'min-w-0 flex-1 items-center bg-transparent px-0.5 py-1.5'
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
                numberOfLines={1}
                allowFontScaling={false}
                style={{ fontSize: labelFontSize, lineHeight: labelLineHeight }}
                className={`mt-0.5 w-full text-center font-sans ${
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
