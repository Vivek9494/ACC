import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState, type ComponentProps } from 'react';
import { colors } from '@/theme/colors';
import {
  Dimensions,
  Modal,
  Pressable,
  View,
  type LayoutRectangle,
} from 'react-native';

import { INPUT_SHADOW_STYLE } from './fieldStyles';
import { Text } from './Text';

const MENU_WIDTH = 220;
const MENU_GAP = 8;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface OverflowMenuAction {
  key: string;
  label: string;
  icon: IoniconName;
  onPress: () => void;
  /** Renders label and icon in brand secondary blue (e.g. Edit). */
  secondary?: boolean;
  /** Renders label and icon in system destructive red (e.g. Delete). */
  destructive?: boolean;
}

interface OverflowMenuProps {
  actions: OverflowMenuAction[];
  accessibilityLabel?: string;
  /** Ellipsis icon color; defaults to muted text. */
  iconColor?: string;
}

/** Matches native Alert destructive button red on iOS. */
const DESTRUCTIVE_MENU_COLOR = '#FF3B30';

function MenuItem({
  label,
  icon,
  onPress,
  secondary = false,
  destructive = false,
}: {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  secondary?: boolean;
  destructive?: boolean;
}): React.ReactElement {
  const iconColor = destructive
    ? DESTRUCTIVE_MENU_COLOR
    : secondary
      ? colors.secondary
      : colors.textMuted;
  const textColor = destructive
    ? DESTRUCTIVE_MENU_COLOR
    : secondary
      ? colors.secondary
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 px-4 py-2.5 active:bg-surface-container-high"
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text
        className="font-sans text-sm text-on-surface"
        style={textColor ? { color: textColor } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Anchored ellipsis menu — same visual pattern as ProfileMenu. */
export function OverflowMenu({
  actions,
  accessibilityLabel = 'More options',
  iconColor = colors.textMuted,
}: OverflowMenuProps): React.ReactElement | null {
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<LayoutRectangle | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      const windowWidth = Dimensions.get('window').width;
      setMenuLayout({
        x: Math.max(16, Math.min(x + width - MENU_WIDTH, windowWidth - MENU_WIDTH - 16)),
        y: y + height + MENU_GAP,
        width: MENU_WIDTH,
        height: 0,
      });
      setOpen(true);
    });
  }, []);

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={iconColor} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View className="flex-1">
          <Pressable
            className="absolute inset-0"
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          {menuLayout ? (
            <View
              className="absolute rounded-control border border-separator bg-surface py-2"
              style={[
                INPUT_SHADOW_STYLE,
                {
                  top: menuLayout.y,
                  left: menuLayout.x,
                  width: menuLayout.width,
                },
              ]}
            >
              {actions.map((action, index) => (
                <View key={action.key}>
                  {index > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                  <MenuItem
                    label={action.label}
                    icon={action.icon}
                    secondary={action.secondary}
                    destructive={action.destructive}
                    onPress={() => {
                      close();
                      action.onPress();
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
